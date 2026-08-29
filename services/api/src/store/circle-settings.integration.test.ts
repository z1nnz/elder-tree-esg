import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "./persistent-store.service";
import { CircleSettingsService } from "./circle-settings.service";

describe.runIf(Boolean(process.env.DATABASE_URL))(
  "circle settings persistence and migration",
  () => {
    const uids = [0, 1, 2].map(() => `circle-settings-${randomUUID()}`);
    let prisma: PrismaService;
    let store: PersistentStoreService;
    let settings: CircleSettingsService;

    beforeAll(() => {
      prisma = new PrismaService();
      store = new PersistentStoreService(prisma);
      settings = new CircleSettingsService(prisma, store, new ClockService());
    });

    afterAll(async () => {
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
      await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
      await prisma.household.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    });

    it("backfills only sole-member legacy circles and preserves names", async () => {
      const schema = `circle_migration_${randomUUID().replaceAll("-", "")}`;
      const rollback = new Error("rollback isolated migration fixture");
      const sql = readFileSync(
        new URL(
          "../../prisma/migrations/20260829060000_circle_setup/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
          await tx.$executeRawUnsafe(
            'CREATE TABLE "User" ("id" TEXT PRIMARY KEY)',
          );
          await tx.$executeRawUnsafe(
            'CREATE TABLE "Household" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL)',
          );
          await tx.$executeRawUnsafe(
            'CREATE TABLE "HouseholdMember" ("householdId" TEXT NOT NULL, "userId" TEXT NOT NULL, PRIMARY KEY ("householdId", "userId"))',
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "User" VALUES ('solo'), ('first'), ('second')`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "Household" VALUES ('one', '保留原圈名', '2026-01-01'), ('many', '不猜圈主', '2026-01-02')`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "HouseholdMember" VALUES ('one', 'solo'), ('many', 'first'), ('many', 'second')`,
          );
          for (const statement of sql
            .replace(/^--.*$/gm, "")
            .split(";")
            .filter((part) => part.trim()))
            await tx.$executeRawUnsafe(statement);
          const members = await tx.$queryRawUnsafe<
            Array<{ userId: string; canManageCircle: boolean }>
          >(
            'SELECT "userId", "canManageCircle" FROM "HouseholdMember" ORDER BY "userId"',
          );
          expect(members).toEqual([
            { userId: "first", canManageCircle: false },
            { userId: "second", canManageCircle: false },
            { userId: "solo", canManageCircle: true },
          ]);
          const circles = await tx.$queryRawUnsafe<
            Array<{ name: string; configured: boolean }>
          >(
            'SELECT "name", ("configuredAt" = "createdAt") AS configured FROM "Household" ORDER BY "id"',
          );
          expect(circles).toEqual([
            { name: "不猜圈主", configured: true },
            { name: "保留原圈名", configured: true },
          ]);
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });

    it("gives a new account a configurable starter circle without guessing a family name", async () => {
      const context = await store.getContext(uids[0]!);
      expect(context.households).toHaveLength(1);
      expect(context.households[0]).toMatchObject({
        name: "我的樹伴圈",
        canManageCircle: true,
        needsSetup: true,
        settingsRevision: 0,
      });
      const updated = await settings.update(
        uids[0]!,
        context.activeHouseholdId,
        { name: "週末散步的朋友", kind: "FRIENDS", expectedRevision: 0 },
      );
      expect(updated.households[0]).toMatchObject({
        name: "週末散步的朋友",
        kind: "FRIENDS",
        needsSetup: false,
        settingsRevision: 1,
      });
    });

    it("creates exactly once on concurrent retries and does not reset a renamed circle", async () => {
      const input = {
        name: "社區慢步",
        kind: "COMMUNITY" as const,
        idempotencyKey: randomUUID(),
      };
      const results = await Promise.all([
        settings.create(uids[0]!, input),
        settings.create(uids[0]!, input),
      ]);
      expect(results[0]!.activeHouseholdId).toBe(results[1]!.activeHouseholdId);
      expect(results[0]!.households).toHaveLength(2);
      const id = results[0]!.activeHouseholdId;
      expect(await prisma.tree.count({ where: { householdId: id } })).toBe(1);
      await settings.update(uids[0]!, id, {
        name: "社區一起走",
        kind: "COMMUNITY",
        expectedRevision: 0,
      });
      const retried = await settings.create(uids[0]!, input);
      expect(retried.households.find((item) => item.id === id)).toMatchObject({
        name: "社區一起走",
        settingsRevision: 1,
      });
      await expect(
        settings.create(uids[0]!, { ...input, name: "不同內容" }),
      ).rejects.toThrow("different settings");
    });

    it("rejects edits by invited members and outsiders, and stale editor conflicts", async () => {
      const owner = await store.getContext(uids[0]!);
      const id = owner.activeHouseholdId;
      const invite = await store.createHouseholdInvite(uids[0]!);
      const joined = await store.joinHousehold(uids[1]!, invite.code, "鄰居");
      expect(
        joined.households.find((item) => item.id === id)?.canManageCircle,
      ).toBe(false);
      const edit = {
        name: "大家的日常",
        kind: "COMMUNITY" as const,
        expectedRevision: 1,
      };
      await expect(settings.update(uids[1]!, id, edit)).rejects.toThrow(
        "manager permission",
      );
      await store.getContext(uids[2]!);
      await expect(settings.update(uids[2]!, id, edit)).rejects.toThrow(
        "membership not found",
      );
      const updated = await settings.update(uids[0]!, id, edit);
      expect(
        updated.households.find((item) => item.id === id)?.settingsRevision,
      ).toBe(2);
      expect(
        (await settings.update(uids[0]!, id, edit)).households.find(
          (item) => item.id === id,
        )?.settingsRevision,
      ).toBe(2);
      await expect(
        settings.update(uids[0]!, id, { ...edit, name: "過時的修改" }),
      ).rejects.toThrow("reload before saving");
    });
  },
);
