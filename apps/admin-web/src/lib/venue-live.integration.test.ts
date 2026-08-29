// @vitest-environment node
import "reflect-metadata";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const run = promisify(execFile);
const database = process.env.VENUE_ACCEPTANCE_DATABASE_URL;
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const require = createRequire(import.meta.url);

describe.runIf(Boolean(database))(
  "real HTTP venue workflow across web and Flutter clients",
  () => {
    const runId = randomUUID();
    const partnerUid = `venue-acceptance-partner-${runId}`;
    const adminUid = `venue-acceptance-admin-${runId}`;
    const memberUid = `venue-acceptance-member-${runId}`;
    const outsiderUid = `venue-acceptance-outsider-${runId}`;
    const uids = [partnerUid, adminUid, memberUid, outsiderUid];
    let prisma: PrismaClient | undefined;
    let app: INestApplication | undefined;
    let organizationId: string | undefined;
    let missionId: string | undefined;
    let baseUrl: string;
    let activeUid = partnerUid;
    let api: typeof import("./api").api;
    let rawFetch: typeof fetch;

    beforeAll(async () => {
      const url = new URL(database!);
      assert(["postgres:", "postgresql:"].includes(url.protocol));
      assert(["localhost", "127.0.0.1"].includes(url.hostname));
      assert(
        /^\/venue_acceptance_[a-z0-9_]+$/.test(url.pathname),
        "Use a dedicated local venue_acceptance_* database, never a project or production database",
      );
      assert(process.env.NODE_ENV !== "production");
      vi.stubEnv("DATABASE_URL", database!);
      // Demo mode also switches some controllers to an in-memory sample tree.
      // Keep every data route persistent and replace identity validation only.
      vi.stubEnv("DEMO_MODE", "false");

      // Use nest build output: esbuild does not emit Nest's DTO/DI metadata.
      const { NestFactory } = require("@nestjs/core");
      const { AppModule } = require(
        join(root, "services/api/dist/app.module.js"),
      );
      const { PrismaService } = require(
        join(root, "services/api/dist/database/prisma.service.js"),
      );
      const { PersistentStoreService } = require(
        join(root, "services/api/dist/store/persistent-store.service.js"),
      );
      const { configureHttp } = require(
        join(root, "services/api/dist/http/configure-http.js"),
      );
      const { ApiAuthGuard } = require(
        join(root, "services/api/dist/security/api-auth.guard.js"),
      );
      vi.spyOn(ApiAuthGuard.prototype, "canActivate").mockImplementation(
        async (context: unknown) => {
          const request = (context as import("@nestjs/common").ExecutionContext)
            .switchToHttp()
            .getRequest();
          const uid = request.header("x-demo-user");
          assert(
            uids.includes(uid),
            "Only this run's fixture identities are allowed",
          );
          request.user = { uid, role: "PARTICIPANT" };
          return true;
        },
      );
      app = await NestFactory.create(AppModule, {
        logger: false,
        rawBody: true,
      });
      configureHttp(app!);
      await app!.listen(0, "127.0.0.1");
      baseUrl = `${await app!.getUrl()}/api/v1`;
      prisma = app!.get(PrismaService);
      const store = app!.get(PersistentStoreService);
      for (const uid of uids) await store.getContext(uid);
      await prisma!.user.update({
        where: { firebaseUid: adminUid },
        data: { role: "PLATFORM_ADMIN" },
      });
      const partner = await prisma!.user.update({
        where: { firebaseUid: partnerUid },
        data: { role: "ORG_ADMIN" },
      });
      organizationId = (
        await prisma!.organization.create({
          data: {
            name: "跨端驗收測試據點（非合作單位）",
            memberships: { create: { userId: partner.id, role: "ORG_ADMIN" } },
          },
        })
      ).id;

      vi.stubEnv("NEXT_PUBLIC_API_URL", baseUrl);
      rawFetch = globalThis.fetch;
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
        const target =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        assert(
          target.startsWith(`${baseUrl}/`),
          "Acceptance must never send requests outside the local server",
        );
        const headers = new Headers(init?.headers);
        // Test identity only. This is not a Firebase authentication acceptance.
        headers.set("x-demo-user", activeUid);
        return rawFetch(input, { ...init, headers });
      });
      vi.resetModules();
      api = (await import("./api")).api;
    }, 30_000);

    afterAll(async () => {
      vi.unstubAllGlobals();
      try {
        if (prisma) {
          const users = await prisma.user.findMany({
            where: { firebaseUid: { in: uids } },
            include: { householdLinks: true },
          });
          const householdIds = [
            ...new Set(
              users.flatMap((user) =>
                user.householdLinks.map((link) => link.householdId),
              ),
            ),
          ];
          if (organizationId)
            await prisma.organization.delete({ where: { id: organizationId } });
          if (missionId)
            await prisma.radarMission.delete({ where: { id: missionId } });
          await prisma.user.deleteMany({
            where: { firebaseUid: { in: uids } },
          });
          await prisma.household.deleteMany({
            where: { id: { in: householdIds } },
          });
        }
      } finally {
        await app?.close();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
      }
    }, 30_000);

    async function mobile(mode: "complete" | "read-redeemed", code = "") {
      const env = {
        ...process.env,
        VENUE_ACCEPTANCE_API_URL: baseUrl,
        VENUE_ACCEPTANCE_MEMBER: memberUid,
        VENUE_ACCEPTANCE_MISSION: missionId!,
        VENUE_ACCEPTANCE_MODE: mode,
        VENUE_ACCEPTANCE_CODE: code,
      };
      let stdout: string;
      try {
        ({ stdout } = await run(
          process.env.FLUTTER_BIN ?? "flutter",
          [
            "test",
            "--no-pub",
            "--reporter",
            "expanded",
            "test/venue_live_test.dart",
          ],
          {
            cwd: join(root, "apps/mobile"),
            env,
            timeout: 90_000,
            maxBuffer: 1024 * 1024,
          },
        ));
      } catch (error) {
        // Test tokens stay in the subprocess pipe; don't persist them in CI logs.
        const output = String(
          (error as { stdout?: string }).stdout ?? error,
        ).replace(/TC[AR]1_[A-Za-z0-9_-]{43}/g, "[test code redacted]");
        throw new Error(`Flutter live client failed: ${output}`);
      }
      const result = stdout.match(/VENUE_ACCEPTANCE_RESULT:(\{[^\n]+\})/);
      assert(
        result,
        "Flutter must report a verified result, not only exit successfully",
      );
      return JSON.parse(result[1]) as {
        code?: string;
        witnessed: boolean;
        redeemed: boolean;
        growthDelta?: number;
      };
    }

    it("publishes through web, completes through Flutter, redeems once and reloads the receipt", async () => {
      const draft = await api.createPartnerCampaign(organizationId!, {
        title: "一起走進友善據點",
        description: "完整跨端測試，不是真實場域參與紀錄。",
        venueName: "跨端測試廣場",
        latitude: 25.033,
        longitude: 121.5654,
        radiusMeters: 60,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        verificationMode: "SELF_CHECK",
        growthPoints: 12,
        accessibilityNotes: "平緩步道與座椅。",
        safetyNotes: "測試資料，不安排外出。",
        optionalOffer: "一杯飲水，不需要消費。",
        purchaseRequired: false,
        requiresVenueWitness: true,
      });
      await api.submitPartnerCampaign(organizationId!, draft.id);
      activeUid = adminUid;
      const campaign = await api.approvePartnerCampaign(
        draft.id,
        "核准隔離測試，不代表准許現場試辦。",
      );
      missionId = campaign.radarMissionId!;
      expect(missionId).toBeTruthy();
      activeUid = outsiderUid;
      await expect(
        api.venueCode(organizationId!, campaign.id),
      ).rejects.toMatchObject({ status: 403 });
      activeUid = partnerUid;
      const arrival = await api.venueCode(organizationId!, campaign.id);
      expect(
        new Date(arrival.expiresAt).getTime() -
          new Date(arrival.serverTime).getTime(),
      ).toBe(60_000);

      // Real HTTP pipe rejects unknown nested fields, rather than silently accepting them.
      const invalid = await rawFetch(
        `${baseUrl}/exploration/radar/${missionId}/complete`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-demo-user": memberUid,
          },
          body: JSON.stringify({
            venueWitness: {
              code: arrival.code,
              latitude: 25.033,
              longitude: 121.5654,
              accuracyMeters: 8,
              occurredAt: new Date().toISOString(),
              clientSaysVerified: true,
            },
          }),
        },
      );
      expect(invalid.status).toBe(400);

      const completed = await mobile("complete", arrival.code);
      expect(completed).toMatchObject({
        witnessed: true,
        redeemed: false,
        growthDelta: 12,
      });
      expect(completed.code).toMatch(/^TCR1_[A-Za-z0-9_-]{43}$/);
      expect(await api.venueMetrics(organizationId!, campaign.id)).toEqual({
        witnessedCount: 1,
        redeemedCount: 0,
      });
      const results = await Promise.all([
        api.redeemVenueOffer(organizationId!, campaign.id, completed.code!),
        api.redeemVenueOffer(organizationId!, campaign.id, completed.code!),
      ]);
      expect(results.map((result) => result.alreadyRedeemed).sort()).toEqual([
        false,
        true,
      ]);
      expect(results[0].redeemedAt).toBe(results[1].redeemedAt);
      expect(await api.venueMetrics(organizationId!, campaign.id)).toEqual({
        witnessedCount: 1,
        redeemedCount: 1,
      });
      expect(await mobile("read-redeemed")).toMatchObject({
        witnessed: true,
        redeemed: true,
      });
      expect(
        await prisma!.venueWitnessReceipt.count({
          where: { campaignId: campaign.id },
        }),
      ).toBe(1);
    }, 180_000);
  },
);
