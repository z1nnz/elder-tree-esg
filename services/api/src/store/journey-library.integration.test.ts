import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { JourneyResult } from "@elder-tree/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service";
import { PersistentStoreService } from "./persistent-store.service";
import { JourneyLibraryService } from "./journey-library.service";

describe.runIf(Boolean(process.env.DATABASE_URL))(
  "journey continuation and immutable results",
  () => {
    const uids = Array.from({ length: 5 }, () => `journey-${randomUUID()}`);
    const fixtureActionIds: string[] = [];
    const fixtureTaskIds: string[] = [];
    let now = new Date();
    const clock = { now: () => now };
    let prisma: PrismaService;
    let store: PersistentStoreService;
    let library: JourneyLibraryService;
    let circleId: string;
    let firstRun: string;
    let spring: string;
    let conversation: string;
    let kindness: string;
    let initialResult: JourneyResult;

    beforeAll(async () => {
      prisma = new PrismaService();
      store = new PersistentStoreService(prisma, clock);
      library = new JourneyLibraryService(prisma, store, clock);
      circleId = (await store.getContext(uids[0]!)).activeHouseholdId;
      for (const uid of uids.slice(1, 3))
        await store.joinHousehold(
          uid,
          (await store.createHouseholdInvite(uids[0]!)).code,
          "朋友",
        );
      const shelf = await library.shelf(uids[0]!);
      spring = shelf.choices.find(
        (item) => item.title === "讓春天回到生命樹",
      )!.actionId;
      conversation = shelf.choices.find(
        (item) => item.title === "聽見彼此的日常",
      )!.actionId;
      kindness = shelf.choices.find(
        (item) => item.title === "把好意傳下去",
      )!.actionId;
      firstRun = (
        await library.start(uids[0]!, {
          circleId,
          actionId: spring,
          previousRunId: shelf.currentRunId!,
        })
      ).activeAction!.runId!;

      // The product catalog can already exist on a reused development
      // database. Pin this isolated fixture to the intended three-person
      // starter instead of depending on global publication order.
      const soloShelf = await library.shelf(uids[3]!);
      await prisma.cooperativeActionRun.update({
        where: { id: soloShelf.currentRunId! },
        data: { actionId: spring },
      });
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
      await prisma.cooperativeAction.deleteMany({
        where: { id: { in: fixtureActionIds } },
      });
      await prisma.task.deleteMany({ where: { id: { in: fixtureTaskIds } } });
      await prisma.$disconnect();
    });

    async function finishCurrent() {
      const first = (await store.getCircleOverview(uids[0]!)).activeAction!;
      for (const [index, chapter] of first.chapters.entries()) {
        now = new Date(now.getTime() + 1000);
        await store.claimCooperativeActionChapter(
          uids[index]!,
          first.runId!,
          chapter.id,
          index === 1,
        );
        if (chapter.verificationMode === "TIMER") {
          now = new Date(now.getTime() + (chapter.minimumSeconds ?? 0) * 1000);
        }
        await store.completeCooperativeActionChapter(
          uids[index]!,
          first.runId!,
          chapter.id,
        );
      }
      return first;
    }

    it("keeps a shared completed result and issues only the real growth receipt", async () => {
      const action = await finishCurrent();
      const shelf = await library.shelf(uids[1]!);
      expect(shelf.completedCount).toBe(1);
      initialResult = shelf.results[0]!;
      expect(initialResult).toMatchObject({
        runId: firstRun,
        growthPoints: 120,
        keepsakeSlot: 0,
        historicalImport: false,
      });
      expect(initialResult.contributions).toHaveLength(3);
      expect(initialResult.contributions[1]?.usedAlternative).toBe(true);
      expect(
        initialResult.contributions.map((item) => item.witnessTier),
      ).toEqual(["SELF_CHECK", "PROCESS", "SELF_CHECK"]);
      expect(initialResult.contributions[1]).toMatchObject({
        witnessMinimumSeconds: 180,
        witnessElapsedSeconds: 180,
      });
      expect(
        shelf.choices.find((item) => item.actionId === action.id)
          ?.unavailableReason,
      ).toBe("COOLDOWN");
      await store.completeCooperativeActionChapter(
        uids[2]!,
        firstRun,
        action.chapters[2]!.id,
      );
      expect(
        await prisma.growthEntry.count({
          where: { idempotencyKey: `cooperative-action:${firstRun}` },
        }),
      ).toBe(1);
      await store.updateDisplayName(uids[0]!, "後來的新名字");
      expect((await library.shelf(uids[0]!)).results[0]).toEqual(initialResult);
    });

    it("starts a two-person journey once across concurrent requests and prevents forks", async () => {
      const input = {
        circleId,
        actionId: conversation,
        previousRunId: firstRun,
      };
      const started = await Promise.all([
        library.start(uids[0]!, input),
        library.start(uids[1]!, input),
      ]);
      expect(started[0]!.activeAction!.runId).toBe(
        started[1]!.activeAction!.runId,
      );
      expect(started[0]!.activeAction!.totalChapterCount).toBe(2);
      expect(
        await prisma.cooperativeActionRun.count({
          where: { previousRunId: firstRun },
        }),
      ).toBe(1);
      await expect(
        library.start(uids[0]!, { ...input, actionId: kindness }),
      ).rejects.toThrow("Journey changed");
      expect((await library.shelf(uids[0]!)).results).toEqual([initialResult]);
      const current = started[0]!.activeAction!;
      await store.claimCooperativeActionChapter(
        uids[0]!,
        current.runId!,
        current.chapters[0]!.id,
      );
      await expect(
        library.start(uids[1]!, {
          circleId,
          actionId: kindness,
          previousRunId: current.runId!,
        }),
      ).rejects.toThrow("Finish the current journey");
      await store.completeCooperativeActionChapter(
        uids[0]!,
        current.runId!,
        current.chapters[0]!.id,
      );
      await store.claimCooperativeActionChapter(
        uids[1]!,
        current.runId!,
        current.chapters[1]!.id,
      );
      now = new Date(now.getTime() + 1000);
      await store.completeCooperativeActionChapter(
        uids[1]!,
        current.runId!,
        current.chapters[1]!.id,
      );
      const completed = await library.shelf(uids[0]!);
      expect(completed.completedCount).toBe(2);
      expect(completed.results[0]!.growthPoints).toBe(80);
      const firstActionId = initialResult.actionId;
      await expect(
        library.start(uids[0]!, {
          circleId,
          actionId: firstActionId,
          previousRunId: current.runId!,
        }),
      ).rejects.toThrow("revisit");
    });

    it("adds a deterministic socket to an older immutable snapshot", async () => {
      const { keepsakeSlot: _oldSlot, ...legacySnapshot } = initialResult;
      await prisma.cooperativeActionRun.update({
        where: { id: firstRun },
        data: { resultSnapshot: legacySnapshot },
      });
      const migrated = (await library.shelf(uids[0]!)).results.find(
        (item) => item.runId === firstRun,
      );
      expect(migrated).toEqual(initialResult);
      expect(
        (
          await prisma.cooperativeActionRun.findUniqueOrThrow({
            where: { id: firstRun },
          })
        ).resultSnapshot,
      ).toMatchObject({ keepsakeSlot: 0 });
    });

    it("reopens after seven days with a new run while preserving both old results", async () => {
      now = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const before = await library.shelf(uids[0]!);
      const reopened = await library.start(uids[0]!, {
        circleId,
        actionId: initialResult.actionId,
        previousRunId: before.currentRunId!,
      });
      expect(reopened.activeAction!.runId).not.toBe(firstRun);
      expect(reopened.activeAction!.completedChapterCount).toBe(0);
      const first = await finishCurrent();
      const shelf = await library.shelf(uids[0]!);
      expect(shelf.completedCount).toBe(3);
      expect(shelf.results.map((item) => item.runId)).toContain(firstRun);
      expect(shelf.results[0]!.runId).toBe(first.runId);
      expect((await store.getTree(uids[0]!)).growthPoints).toBe(320);
      expect(
        await prisma.cooperativeActionRun.count({
          where: { householdId: circleId, isCurrent: true },
        }),
      ).toBe(1);
    });

    it("rejects an outsider and a foreign history cursor", async () => {
      await expect(
        library.start(uids[3]!, {
          circleId,
          actionId: kindness,
          previousRunId: firstRun,
        }),
      ).rejects.toThrow("Circle changed");
      await expect(library.shelf(uids[3]!, firstRun)).rejects.toThrow(
        "record not found",
      );
      expect((await library.shelf(uids[3]!)).results).toEqual([]);
    });

    it("allows an untouched starter to be replaced, but preserves the retired run", async () => {
      const current = await library.shelf(uids[0]!);
      const started = await library.start(uids[0]!, {
        circleId,
        actionId: conversation,
        previousRunId: current.currentRunId!,
      });
      const untouchedId = started.activeAction!.runId!;
      await library.start(uids[1]!, {
        circleId,
        actionId: kindness,
        previousRunId: untouchedId,
      });
      expect(
        await prisma.cooperativeActionRun.findUnique({
          where: { id: untouchedId },
        }),
      ).toMatchObject({ status: "EXPIRED", isCurrent: false });
      await expect(
        store.claimCooperativeActionChapter(
          uids[0]!,
          untouchedId,
          started.activeAction!.chapters[0]!.id,
        ),
      ).rejects.toThrow("not found");
      expect((await library.shelf(uids[0]!)).completedCount).toBe(3);
    });

    it("paginates old results without duplicates and labels imported records", async () => {
      await prisma.cooperativeActionRun.createMany({
        data: Array.from({ length: 14 }, (_, index) => ({
          householdId: circleId,
          actionId: kindness,
          isCurrent: false,
          status: "COMPLETED" as const,
          startedAt: new Date(now.getTime() - (index + 30) * 86400000),
          completedAt: new Date(now.getTime() - (index + 29) * 86400000),
        })),
      });
      const first = await library.shelf(uids[0]!);
      expect(first.completedCount).toBe(17);
      expect(first.results).toHaveLength(12);
      const second = await library.shelf(uids[1]!, first.nextCursor!);
      expect(second.results).toHaveLength(5);
      expect(second.nextCursor).toBeNull();
      const results = [...first.results, ...second.results];
      expect(new Set(results.map((item) => item.runId)).size).toBe(17);
      expect(results.filter((item) => item.historicalImport)).toHaveLength(14);
      const imported = results
        .filter((item) => item.historicalImport)
        .sort(
          (left, right) =>
            left.completedAt.localeCompare(right.completedAt) ||
            left.runId.localeCompare(right.runId),
        );
      expect(imported.map((item) => item.keepsakeSlot)).toEqual(
        imported.map((_, index) => index % 12),
      );
      expect(results.find((item) => item.runId === firstRun)).toEqual(
        initialResult,
      );
    });

    it("serializes replacing an untouched journey against a simultaneous claim", async () => {
      const current = (await store.getCircleOverview(uids[0]!)).activeAction!;
      const outcomes = await Promise.allSettled([
        store.claimCooperativeActionChapter(
          uids[0]!,
          current.runId!,
          current.chapters[0]!.id,
        ),
        library.start(uids[1]!, {
          circleId,
          actionId: conversation,
          previousRunId: current.runId!,
        }),
      ]);
      expect(
        outcomes.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.cooperativeActionRun.count({
          where: { householdId: circleId, isCurrent: true },
        }),
      ).toBe(1);
      const retiredClaim = await prisma.cooperativeActionRun.count({
        where: {
          householdId: circleId,
          isCurrent: false,
          claimedById: { not: null },
        },
      });
      expect(retiredClaim).toBe(0);
    });

    it("lets two members choose a two-person journey before touching the three-person starter", async () => {
      const solo = await library.shelf(uids[3]!);
      const input = {
        circleId: solo.circleId,
        actionId: conversation,
        previousRunId: solo.currentRunId!,
      };
      expect(
        solo.choices.find((item) => item.actionId === conversation)
          ?.unavailableReason,
      ).toBe("NOT_ENOUGH_MEMBERS");
      await expect(library.start(uids[3]!, input)).rejects.toThrow(
        "Invite more",
      );
      await store.joinHousehold(
        uids[4]!,
        (await store.createHouseholdInvite(uids[3]!)).code,
        "朋友",
      );
      const selected = await library.start(uids[3]!, input);
      expect(selected.activeAction?.minimumContributors).toBe(2);
      expect(selected.memberCount).toBe(2);
      expect(
        await prisma.cooperativeActionRun.findUnique({
          where: { id: solo.currentRunId! },
        }),
      ).toMatchObject({ status: "EXPIRED", isCurrent: false });
    });

    it.each(["archived", "ended", "rescheduled"] as const)(
      "lets a circle leave a claimed journey when its template is %s",
      async (condition) => {
        const members = [`journey-${randomUUID()}`, `journey-${randomUUID()}`];
        uids.push(...members);
        await store.joinHousehold(
          members[1]!,
          (await store.createHouseholdInvite(members[0]!)).code,
          "朋友",
        );
        const before = await library.shelf(members[0]!);
        const task = await prisma.task.create({
          data: {
            title: "分享日常",
            description: "隔離測試資料",
            verificationMode: "SELF_CHECK",
            verificationRule: { confirmationRequired: true },
            growthPoints: 0,
          },
        });
        fixtureTaskIds.push(task.id);
        const action = await prisma.cooperativeAction.create({
          data: {
            slug: `journey-availability-${randomUUID()}`,
            title: "旅程時段測試",
            description: "隔離測試資料",
            keepsakeName: "測試葉",
            growthPoints: 0,
            kind: "RELAY",
            status: "PUBLISHED",
            minimumContributors: 2,
            maxChaptersPerMember: 1,
            publishedAt: now,
            chapters: {
              create: {
                sequence: 1,
                elementName: "分享",
                taskId: task.id,
              },
            },
          },
        });
        fixtureActionIds.push(action.id);
        const selected = (
          await library.start(members[0]!, {
            circleId: before.circleId,
            actionId: action.id,
            previousRunId: before.currentRunId!,
          })
        ).activeAction!;
        await store.claimCooperativeActionChapter(
          members[0]!,
          selected.runId!,
          selected.chapters[0]!.id,
        );
        await prisma.cooperativeAction.update({
          where: { id: action.id },
          data:
            condition === "archived"
              ? { status: "ARCHIVED" }
              : condition === "ended"
                ? { endsAt: now }
                : { startsAt: new Date(now.getTime() + 86400000) },
        });
        expect(
          (await store.getCircleOverview(members[0]!)).activeAction?.status,
        ).toBe("EXPIRED");
        const shelf = await library.shelf(members[1]!);
        expect(
          shelf.choices.find((item) => item.actionId === conversation)
            ?.unavailableReason,
        ).toBeNull();
        const next = await library.start(members[1]!, {
          circleId: before.circleId,
          actionId: conversation,
          previousRunId: selected.runId!,
        });
        expect(next.activeAction?.id).toBe(conversation);
        expect(
          await prisma.cooperativeActionRun.findUnique({
            where: { id: selected.runId! },
          }),
        ).toMatchObject({ status: "EXPIRED", isCurrent: false });
      },
    );

    it("migrates old runs without deleting contributions and enforces one current run", async () => {
      const schema = `journey_migration_${randomUUID().replaceAll("-", "")}`;
      const sql = readFileSync(
        new URL(
          "../../prisma/migrations/20260829070000_journey_continuation/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
          await tx.$executeRawUnsafe(
            'CREATE TABLE "CooperativeActionRun" ("id" TEXT PRIMARY KEY, "actionId" TEXT NOT NULL, "householdId" TEXT NOT NULL, "status" TEXT NOT NULL, "startedAt" TIMESTAMP NOT NULL, "claimedById" TEXT)',
          );
          await tx.$executeRawUnsafe(
            'CREATE TABLE "CooperativeActionContribution" ("runId" TEXT NOT NULL)',
          );
          await tx.$executeRawUnsafe(
            'CREATE UNIQUE INDEX "CooperativeActionRun_actionId_householdId_key" ON "CooperativeActionRun"("actionId", "householdId")',
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "CooperativeActionRun" VALUES ('older', 'a', 'circle', 'ACTIVE', '2026-01-01', NULL), ('newer', 'b', 'circle', 'ACTIVE', '2026-01-02', NULL)`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "CooperativeActionContribution" VALUES ('older')`,
          );
          for (const statement of sql
            .replace(/^--.*$/gm, "")
            .split(";")
            .filter((part) => part.trim()))
            await tx.$executeRawUnsafe(statement);
          expect(
            await tx.$queryRawUnsafe(
              'SELECT "id" FROM "CooperativeActionRun" WHERE "isCurrent"',
            ),
          ).toEqual([{ id: "older" }]);
          expect(
            await tx.$queryRawUnsafe(
              'SELECT "runId" FROM "CooperativeActionContribution"',
            ),
          ).toEqual([{ runId: "older" }]);
          // The deliberate violation rolls the entire fixture schema back.
          await tx.$executeRawUnsafe(
            `UPDATE "CooperativeActionRun" SET "isCurrent" = true WHERE "id" = 'newer'`,
          );
        }),
      ).rejects.toMatchObject({ code: "P2010", meta: { code: "23505" } });
    });
  },
);
