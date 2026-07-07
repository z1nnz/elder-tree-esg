import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service";
import type { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "./persistent-store.service";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
if (databaseUrl) {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
}

describeWithDatabase("PersistentStoreService", () => {
  const firebaseUid = `integration-${randomUUID()}`;
  const createdFirebaseUids = new Set([firebaseUid]);
  const createdTaskIds = new Set<string>();
  const createdRouteIds = new Set<string>();
  const createdDeviceIds = new Set<string>();
  let prisma: PrismaService;
  let store: PersistentStoreService;

  beforeAll(async () => {
    prisma = new PrismaService();
    store = new PersistentStoreService(prisma);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [...createdFirebaseUids] } },
      include: { householdLinks: true },
    });
    const householdIds = new Set(
      users.flatMap((user) => user.householdLinks.map((link) => link.householdId)),
    );
    await prisma.device.deleteMany({
      where: { id: { in: [...createdDeviceIds] } },
    });
    await prisma.user.deleteMany({
      where: { firebaseUid: { in: [...createdFirebaseUids] } },
    });
    for (const householdId of householdIds) {
      await prisma.household.deleteMany({ where: { id: householdId } });
    }
    await prisma.explorationRoute.deleteMany({
      where: { id: { in: [...createdRouteIds] } },
    });
    await prisma.task.deleteMany({ where: { id: { in: [...createdTaskIds] } } });
    await prisma.$disconnect();
  });

  it(
    "persists task completion and awards growth only once across restarts",
    async () => {
      const tasks = await store.listTasks(firebaseUid);
      const task = tasks.find((item) => item.verificationMode === "SELF_CHECK");
      expect(task).toBeDefined();

      const before = await store.getTree(firebaseUid);
      await store.completeTask(firebaseUid, task!.id);
      const afterFirstCompletion = await store.getTree(firebaseUid);

      await prisma.$disconnect();
      prisma = new PrismaService();
      store = new PersistentStoreService(prisma);

      await store.completeTask(firebaseUid, task!.id);
      const afterRestartAndRetry = await store.getTree(firebaseUid);

      expect(afterFirstCompletion.growthPoints).toBe(
        before.growthPoints + task!.growthPoints,
      );
      expect(afterRestartAndRetry.growthPoints).toBe(
        afterFirstCompletion.growthPoints,
      );
      expect(
        (await store.listTasks(firebaseUid)).find((item) => item.id === task!.id)
          ?.status,
      ).toBe("COMPLETED");
    },
    120_000,
  );

  it(
    "keeps tasks, messages, and tree growth isolated to the active household",
    async () => {
      const inviterUid = `integration-inviter-${randomUUID()}`;
      const joinerUid = `integration-joiner-${randomUUID()}`;
      createdFirebaseUids.add(inviterUid);
      createdFirebaseUids.add(joinerUid);

      const inviterContext = await store.getContext(inviterUid);
      const joinerPersonalContext = await store.getContext(joinerUid);
      const invite = await store.createHouseholdInvite(inviterUid);
      const joinedContext = await store.joinHousehold(
        joinerUid,
        invite.code,
        "家人",
      );

      expect(joinedContext.households).toHaveLength(2);
      expect(joinedContext.activeHouseholdId).toBe(
        inviterContext.activeHouseholdId,
      );

      await store.createMessage(joinerUid, "共享家庭的第一則訊息");
      expect((await store.listMessages(inviterUid))[0]?.body).toBe(
        "共享家庭的第一則訊息",
      );

      const sharedTask = (await store.listTasks(joinerUid)).find(
        (task) => task.verificationMode === "SELF_CHECK",
      );
      expect(sharedTask).toBeDefined();
      await store.completeTask(joinerUid, sharedTask!.id);
      expect((await store.getTree(inviterUid)).growthPoints).toBe(30);

      await store.setActiveHousehold(
        joinerUid,
        joinerPersonalContext.activeHouseholdId,
      );
      expect((await store.getTree(joinerUid)).growthPoints).toBe(0);
      expect(await store.listMessages(joinerUid)).toEqual([]);

      await store.setActiveHousehold(
        joinerUid,
        inviterContext.activeHouseholdId,
      );
      expect((await store.getTree(joinerUid)).growthPoints).toBe(30);
    },
    120_000,
  );

  it(
    "requires the configured timer duration before awarding growth",
    async () => {
      const timerUid = `integration-timer-${randomUUID()}`;
      createdFirebaseUids.add(timerUid);
      let now = new Date("2026-07-06T00:00:00.000Z");
      const timerStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);
      const timerTask = (await timerStore.listTasks(timerUid)).find(
        (task) => task.verificationMode === "TIMER",
      );
      expect(timerTask).toBeDefined();

      const started = await timerStore.startTask(timerUid, timerTask!.id);
      expect(started.startedAt).toBe("2026-07-06T00:00:00.000Z");

      now = new Date("2026-07-06T00:09:59.000Z");
      await expect(
        timerStore.completeTask(timerUid, timerTask!.id),
      ).rejects.toThrow("1 more seconds");

      now = new Date("2026-07-06T00:10:00.000Z");
      await timerStore.completeTask(timerUid, timerTask!.id);
      expect((await timerStore.getTree(timerUid)).growthPoints).toBe(60);
    },
    60_000,
  );

  it(
    "claims only a pre-provisioned device with the hashed claim code",
    async () => {
      const claimantUid = `integration-device-${randomUUID()}`;
      const otherUid = `integration-device-other-${randomUUID()}`;
      createdFirebaseUids.add(claimantUid);
      createdFirebaseUids.add(otherUid);
      await store.getContext(claimantUid);
      await store.getContext(otherUid);

      const serialNumber = `TREE-${randomUUID()}`;
      const claimCode = "482951";
      const pepper = `integration-pepper-${randomUUID()}`;
      const previousPepper = process.env.DEVICE_CLAIM_PEPPER;
      process.env.DEVICE_CLAIM_PEPPER = pepper;
      const claimCodeHash = createHash("sha256")
        .update(`${pepper}\u0000${serialNumber}\u0000${claimCode}`)
        .digest("hex");
      const device = await prisma.device.create({
        data: {
          serialNumber,
          thingName: `integration-${randomUUID()}`,
          claimCodeHash,
          firmwareVersion: "integration-test",
        },
      });
      createdDeviceIds.add(device.id);

      try {
        expect(await store.listDevices(claimantUid)).toEqual([]);
        await expect(
          store.claimDevice(claimantUid, serialNumber, "000000"),
        ).rejects.toThrow("Invalid serial number or claim code");

        const claimed = await store.claimDevice(
          claimantUid,
          serialNumber,
          claimCode,
        );
        expect(claimed.serialNumber).toBe(serialNumber);
        expect(claimed.claimed).toBe(true);
        expect(await store.listDevices(claimantUid)).toHaveLength(1);
        await expect(
          store.claimDevice(otherUid, serialNumber, claimCode),
        ).rejects.toThrow("already claimed");
      } finally {
        if (previousPepper === undefined) {
          delete process.env.DEVICE_CLAIM_PEPPER;
        } else {
          process.env.DEVICE_CLAIM_PEPPER = previousPepper;
        }
      }
    },
    60_000,
  );

  it(
    "keeps private photo evidence upload locked without storage while inline Gemini stays available",
    async () => {
      delete process.env.PHOTO_EVIDENCE_ENABLED;
      const lockedUid = `integration-photo-locked-${randomUUID()}`;
      createdFirebaseUids.add(lockedUid);
      const context = await store.getContext(lockedUid);
      const photoTask = (await store.listTasks(lockedUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );

      expect(context.capabilities.photoEvidence).toEqual({
        enabled: false,
        reason: "STORAGE_NOT_CONFIGURED",
      });
      expect(context.capabilities.geminiPhotoVerification).toEqual({
        enabled: true,
        reason: null,
      });
      expect(photoTask?.capability).toEqual({
        enabled: true,
        reason: null,
      });
      await expect(
        store.initializeEvidence(
          lockedUid,
          photoTask!.id,
          "locked.jpg",
          "image/jpeg",
        ),
      ).rejects.toThrow("private storage is configured");
    },
    60_000,
  );

  it(
    "completes Gemini photo tasks without private storage and stays idempotent",
    async () => {
      delete process.env.PHOTO_EVIDENCE_ENABLED;
      const verifier = {
        verifyInline: vi.fn().mockResolvedValue({
          decision: "PASS",
          confidence: 0.92,
          labels: ["plant", "flower"],
          reasonCodes: ["RULES_SATISFIED"],
          explanation: "A plant and flower are visible.",
          model: "fake-gemini",
          ruleVersion: "1.0.0",
        }),
      };
      store = new PersistentStoreService(
        prisma,
        undefined,
        undefined,
        verifier as never,
      );
      const photoUid = `integration-gemini-photo-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const photoTask = (await store.listTasks(photoUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );
      expect(photoTask).toBeDefined();

      const before = await store.getTree(photoUid);
      const first = await store.completeGeminiPhotoTask(
        photoUid,
        photoTask!.id,
        {
          imageBase64: "ZmFrZS1qcGVn",
          contentType: "image/jpeg",
          idempotencyKey: "gemini-plant-photo",
        },
      );
      await store.completeGeminiPhotoTask(photoUid, photoTask.id, {
        imageBase64: "ZmFrZS1qcGVn",
        contentType: "image/jpeg",
        idempotencyKey: "gemini-plant-photo",
      });
      const afterRetry = await store.getTree(photoUid);

      expect(verifier.verifyInline).toHaveBeenCalledTimes(1);
      expect(first.status).toBe("COMPLETED");
      expect(afterRetry.growthPoints).toBe(
        before.growthPoints + photoTask.growthPoints,
      );
    },
    60_000,
  );

  it(
    "rejects Gemini photo tasks when the verifier does not pass",
    async () => {
      const verifier = {
        verifyInline: vi.fn().mockResolvedValue({
          decision: "REVIEW",
          confidence: 0.64,
          labels: ["chair"],
          reasonCodes: ["MISSING_REQUIRED_LABEL"],
          explanation: "No plant is visible.",
          model: "fake-gemini",
          ruleVersion: "1.0.0",
        }),
      };
      store = new PersistentStoreService(
        prisma,
        undefined,
        undefined,
        verifier as never,
      );
      const photoUid = `integration-gemini-photo-rejected-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const photoTask = (await store.listTasks(photoUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );
      expect(photoTask).toBeDefined();

      await expect(
        store.completeGeminiPhotoTask(photoUid, photoTask!.id, {
          imageBase64: "ZmFrZS1qcGVn",
          contentType: "image/jpeg",
          idempotencyKey: "gemini-chair-photo",
        }),
      ).rejects.toThrow("Photo verification did not pass");

      expect((await store.getTree(photoUid)).growthPoints).toBe(0);
    },
    60_000,
  );

  it(
    "lets another household member review photo evidence exactly once",
    async () => {
      const previousPhotoEvidenceEnabled =
        process.env.PHOTO_EVIDENCE_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      const submitterUid = `integration-photo-${randomUUID()}`;
      const reviewerUid = `integration-reviewer-${randomUUID()}`;
      createdFirebaseUids.add(submitterUid);
      createdFirebaseUids.add(reviewerUid);
      const deletedPaths: string[] = [];
      const fakeStorage = {
        assertUploaded: async () => undefined,
        createSignedReadUrl: async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        deleteObject: async (path: string) => {
          deletedPaths.push(path);
        },
      };
      const fakeVerifier = {
        verify: async () => ({
          decision: "REVIEW",
          confidence: 0.72,
          labels: ["plant"],
          reasonCodes: ["LOW_CONFIDENCE"],
          explanation: "A plant is visible but needs a person to confirm.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        }),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      const submitterContext = await photoStore.getContext(submitterUid);
      const invite = await photoStore.createHouseholdInvite(submitterUid);
      await photoStore.joinHousehold(reviewerUid, invite.code, "志願陪伴者");

      const photoTask = (await photoStore.listTasks(submitterUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );
      expect(photoTask).toBeDefined();
      const evidence = await photoStore.initializeEvidence(
        submitterUid,
        photoTask!.id,
        "plant.jpg",
        "image/jpeg",
      );
      const verification = await photoStore.completeEvidence(
        submitterUid,
        evidence.id,
        "1234567890abcdef",
      );

      expect(verification.decision).toBe("REVIEW");
      expect((await photoStore.getTree(submitterUid)).growthPoints).toBe(0);
      expect(await photoStore.listFamilyReviews(submitterUid)).toEqual([]);
      const reviewerQueue = await photoStore.listFamilyReviews(reviewerUid);
      expect(reviewerQueue).toHaveLength(1);

      await photoStore.decideFamilyReview(
        reviewerUid,
        reviewerQueue[0]!.id,
        "PASS",
      );
      await photoStore.decideFamilyReview(
        reviewerUid,
        reviewerQueue[0]!.id,
        "PASS",
      );

      await photoStore.setActiveHousehold(
        reviewerUid,
        submitterContext.activeHouseholdId,
      );
      expect((await photoStore.getTree(reviewerUid)).growthPoints).toBe(80);
      expect(deletedPaths.length).toBeGreaterThanOrEqual(1);
      expect(new Set(deletedPaths)).toEqual(new Set([evidence.storagePath]));
      if (previousPhotoEvidenceEnabled === undefined) {
        delete process.env.PHOTO_EVIDENCE_ENABLED;
      } else {
        process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
      }
    },
    60_000,
  );

  it(
    "publishes valid admin routes and keeps published versions immutable",
    async () => {
      const route = await store.createAdminExplorationRoute({
        slug: `admin-route-${randomUUID()}`,
        name: "後台測試路線",
        description: "用公開介面驗證草稿、任務與發布後不可修改。",
        badgeName: "後台測試徽章",
        badgeAssetKey: "admin-test",
      });
      createdRouteIds.add(route.id);
      const firstRoutes = await store.createAdminExplorationQuest({
        routeId: route.id,
        sequence: 1,
        locationName: "測試地標",
        category: "NATURE",
        safetyNote: "待現場確認。",
        accessibilityTags: ["待確認"],
        title: "觀察一棵樹",
        description: "停下來觀察一棵樹的形狀。",
        verificationMode: "SELF_CHECK",
        growthPoints: 5,
        triggerType: "GEOFENCE",
        latitude: 25.0316,
        longitude: 121.5362,
        radiusMeters: 50,
      });
      const firstDraft = firstRoutes.find((item) => item.id === route.id)!;
      const secondRoutes = await store.createAdminExplorationQuest({
        routeId: route.id,
        sequence: 2,
        locationName: "第二個測試地標",
        category: "REST",
        safetyNote: "待現場確認。",
        accessibilityTags: ["待確認"],
        title: "停下來休息",
        description: "依自己的狀況停下來休息。",
        verificationMode: "SELF_CHECK",
        growthPoints: 4,
        triggerType: "GEOFENCE",
        latitude: 25.032,
        longitude: 121.5368,
        radiusMeters: 50,
      });
      const draft = secondRoutes.find((item) => item.id === route.id)!;
      createdTaskIds.add(firstDraft.quests[0]!.taskId);
      createdTaskIds.add(draft.quests[1]!.taskId);
      const reordered = await store.reorderAdminExplorationQuests(route.id, [
        draft.quests[1]!.id,
        draft.quests[0]!.id,
      ]);
      expect(
        reordered.find((item) => item.id === route.id)?.quests[0]?.title,
      ).toBe("停下來休息");

      const published = await store.publishAdminExplorationRoute(route.id);
      expect(published.status).toBe("PUBLISHED");
      expect(
        (await store.getPublicExplorationRoute(route.slug)).totalQuestCount,
      ).toBe(2);
      await expect(
        store.updateAdminExplorationRoute(route.id, { name: "不應被修改" }),
      ).rejects.toThrow("immutable");
    },
    60_000,
  );

  it(
    "computes exploration distance on the server and awards a route badge once",
    async () => {
      const explorerUid = `integration-explorer-${randomUUID()}`;
      const routeId = randomUUID();
      const distanceTaskId = randomUUID();
      const placeTaskId = randomUUID();
      createdFirebaseUids.add(explorerUid);
      createdRouteIds.add(routeId);
      createdTaskIds.add(distanceTaskId);
      createdTaskIds.add(placeTaskId);
      let now = new Date("2026-07-06T05:00:00.000Z");
      const explorationStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);

      await prisma.explorationRoute.create({
        data: {
          id: routeId,
          slug: `integration-route-${randomUUID()}`,
          name: "整合測試綠徑",
          description: "驗證伺服器計距、地標解鎖與徽章。",
          badgeName: "整合測試徽章",
          badgeAssetKey: "integration-leaf",
          status: "PUBLISHED",
          publishedAt: now,
          quests: {
            create: [
              {
                sequence: 1,
                locationName: "第一段步行",
                category: "DISTANCE",
                triggerType: "DISTANCE",
                unlockDistanceMeters: 80,
                task: {
                  create: {
                    id: distanceTaskId,
                    title: "完成第一段步行",
                    description: "走完第一段後確認自己的狀態。",
                    verificationMode: "SELF_CHECK",
                    verificationRule: { source: "exploration" },
                    growthPoints: 6,
                  },
                },
              },
              {
                sequence: 2,
                locationName: "測試地標",
                category: "NATURE",
                triggerType: "GEOFENCE",
                latitude: 25.0338,
                longitude: 121.5357,
                radiusMeters: 50,
                task: {
                  create: {
                    id: placeTaskId,
                    title: "抵達測試地標",
                    description: "抵達後完成一項自我確認。",
                    verificationMode: "SELF_CHECK",
                    verificationRule: { source: "exploration" },
                    growthPoints: 8,
                  },
                },
              },
            ],
          },
        },
      });

      const session = await explorationStore.startExplorationSession(
        explorerUid,
        routeId,
      );
      const firstEventKey = `walk-${randomUUID()}`;
      const first = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: firstEventKey,
          latitude: 25.0328,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(first.acceptedDistanceMeters).toBe(0);

      now = new Date("2026-07-06T05:00:01.000Z");
      await expect(
        explorationStore.recordExplorationSessionEvent(
          explorerUid,
          session.id,
          {
            eventKey: `walk-jump-${randomUUID()}`,
            latitude: 25.05,
            longitude: 121.5357,
            accuracyMeters: 10,
            occurredAt: now.toISOString(),
          },
        ),
      ).rejects.toThrow("too fast");

      now = new Date("2026-07-06T05:02:00.000Z");
      const secondEventKey = `walk-${randomUUID()}`;
      const second = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: secondEventKey,
          latitude: 25.0338,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(second.acceptedDistanceMeters).toBeGreaterThanOrEqual(100);
      expect(new Set(second.newlyUnlockedTaskIds)).toEqual(
        new Set([distanceTaskId, placeTaskId]),
      );

      const duplicate = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: secondEventKey,
          latitude: 25.0338,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(duplicate.duplicate).toBe(true);

      const unlockedTasks = await explorationStore.listTasks(explorerUid);
      const distanceTask = unlockedTasks.find(
        (task) => task.title === "完成第一段步行",
      );
      const placeTask = unlockedTasks.find(
        (task) => task.title === "抵達測試地標",
      );
      await explorationStore.completeTask(explorerUid, distanceTask!.id);
      await explorationStore.completeTask(explorerUid, placeTask!.id);
      await explorationStore.completeTask(explorerUid, placeTask!.id);

      const state = await explorationStore.getExplorationState(explorerUid);
      const completedRoute = state.routes.find((route) => route.id === routeId);
      expect(completedRoute?.completedQuestCount).toBe(2);
      expect(completedRoute?.badgeAwarded).toBe(true);
      expect(
        await prisma.explorationRouteAward.count({
          where: { routeId, user: { firebaseUid: explorerUid } },
        }),
      ).toBe(1);

      now = new Date("2026-07-06T09:02:01.000Z");
      await expect(
        explorationStore.recordExplorationSessionEvent(
          explorerUid,
          session.id,
          {
            eventKey: `walk-expired-${randomUUID()}`,
            latitude: 25.0338,
            longitude: 121.5357,
            accuracyMeters: 10,
            occurredAt: now.toISOString(),
          },
        ),
      ).rejects.toThrow("Active exploration session not found");

      await explorationStore.endExplorationSession(explorerUid, session.id);
      const ended = await prisma.explorationSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(ended.status).toBe("EXPIRED");
      expect(ended.lastLatitude).toBeNull();
      expect(ended.lastLongitude).toBeNull();
      const receipts = await prisma.locationEventReceipt.findMany({
        where: { user: { firebaseUid: explorerUid } },
      });
      expect(receipts.every((receipt) => receipt.coarseCell.length > 0)).toBe(
        true,
      );
    },
    60_000,
  );
});
