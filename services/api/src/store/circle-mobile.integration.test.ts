import "reflect-metadata";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const run = promisify(execFile);
const database = process.env.CIRCLE_ACCEPTANCE_DATABASE_URL;
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const require = createRequire(import.meta.url);

describe.runIf(Boolean(database))(
  "mobile circle membership and shared relay over real HTTP",
  () => {
    const uids = Array.from(
      { length: 3 },
      () => `circle-acceptance-${randomUUID()}`,
    );
    let app: INestApplication | undefined;
    let prisma: PrismaClient | undefined;
    let baseUrl: string;

    beforeAll(async () => {
      const url = new URL(database!);
      assert(["postgres:", "postgresql:"].includes(url.protocol));
      assert(["127.0.0.1", "localhost"].includes(url.hostname));
      assert(
        /^\/(circle|venue)_acceptance_[a-z0-9_]+$/.test(url.pathname),
        "Use a dedicated local acceptance database only.",
      );
      assert(process.env.NODE_ENV !== "production");
      vi.stubEnv("DATABASE_URL", database!);
      vi.stubEnv("DEMO_MODE", "false");
      const { NestFactory } = require("@nestjs/core");
      const { AppModule } = require(
        join(root, "services/api/dist/app.module.js"),
      );
      const { PrismaService } = require(
        join(root, "services/api/dist/database/prisma.service.js"),
      );
      const { configureHttp } = require(
        join(root, "services/api/dist/http/configure-http.js"),
      );
      const { ApiAuthGuard } = require(
        join(root, "services/api/dist/security/api-auth.guard.js"),
      );
      // Only identity is replaced. Controllers, DTO validation, transactions and
      // client parsing remain real. This does not claim Firebase acceptance.
      vi.spyOn(ApiAuthGuard.prototype, "canActivate").mockImplementation(
        async (context: unknown) => {
          const request = (context as ExecutionContext)
            .switchToHttp()
            .getRequest();
          const uid = request.header("x-demo-user");
          assert(
            uids.includes(uid),
            "Only this run's identities are permitted.",
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
      prisma = app!.get(PrismaService);
      baseUrl = `${await app!.getUrl()}/api/v1`;
    }, 30_000);

    afterAll(async () => {
      try {
        if (prisma) {
          const users = await prisma.user.findMany({
            where: { firebaseUid: { in: uids } },
            include: { householdLinks: true },
          });
          const ids = [
            ...new Set(
              users.flatMap((user) =>
                user.householdLinks.map((link) => link.householdId),
              ),
            ),
          ];
          await prisma.user.deleteMany({
            where: { firebaseUid: { in: uids } },
          });
          await prisma.household.deleteMany({ where: { id: { in: ids } } });
        }
      } finally {
        await app?.close();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
      }
    }, 30_000);

    it("joins without losing the original circle and persists exactly one relay reward", async () => {
      let output: string;
      try {
        const result = await run(
          process.env.FLUTTER_BIN ?? "flutter",
          [
            "test",
            "--no-pub",
            "--reporter",
            "expanded",
            "test/circle_live_test.dart",
          ],
          {
            cwd: join(root, "apps/mobile"),
            env: {
              ...process.env,
              CIRCLE_ACCEPTANCE_API_URL: baseUrl,
              CIRCLE_ACCEPTANCE_MEMBERS: uids.join(","),
            },
            timeout: 90_000,
            maxBuffer: 1024 * 1024,
          },
        );
        output = result.stdout;
      } catch (error) {
        throw new Error(
          `Mobile acceptance failed: ${String((error as { stdout?: string }).stdout ?? error)}`,
        );
      }
      expect(output).toContain(
        "CIRCLE_ACCEPTANCE_PASSED:3-members-3-chapters-1-reward",
      );
      expect(
        await prisma!.householdMember.count({
          where: { user: { firebaseUid: { in: uids } } },
        }),
      ).toBe(5);
    }, 100_000);
  },
);
