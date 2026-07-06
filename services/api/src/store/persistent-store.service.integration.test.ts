import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service";
import type { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "./persistent-store.service";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PersistentStoreService", () => {
  const firebaseUid = `integration-${randomUUID()}`;
  const createdFirebaseUids = new Set([firebaseUid]);
  const createdTaskIds = new Set<string>();
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
    30_000,
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
    30_000,
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
    30_000,
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
    30_000,
  );

  it(
    "lets another household member review photo evidence exactly once",
    async () => {
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
    },
    30_000,
  );

  it(
    "unlocks a distance quest once without storing a precise location trail",
    async () => {
      const explorerUid = `integration-explorer-${randomUUID()}`;
      const questTaskId = randomUUID();
      createdFirebaseUids.add(explorerUid);
      createdTaskIds.add(questTaskId);
      await prisma.task.create({
        data: {
          id: questTaskId,
          title: "走出第一個五百公尺",
          description: "用自己的步調探索附近的街區。",
          verificationMode: "LOCATION_CHECK_IN",
          verificationRule: { source: "exploration" },
          growthPoints: 40,
          mapQuest: {
            create: {
              triggerType: "DISTANCE",
              unlockDistanceMeters: 500,
            },
          },
        },
      });

      const first = await store.recordExplorationEvent(explorerUid, {
        eventKey: `walk-${randomUUID()}`,
        latitude: 25.033,
        longitude: 121.5654,
        accuracyMeters: 12,
        distanceMeters: 300,
        occurredAt: new Date().toISOString(),
      });
      expect(first.newlyUnlockedTaskIds).toEqual([]);

      const secondEventKey = `walk-${randomUUID()}`;
      const second = await store.recordExplorationEvent(explorerUid, {
        eventKey: secondEventKey,
        latitude: 25.034,
        longitude: 121.566,
        accuracyMeters: 15,
        distanceMeters: 250,
        occurredAt: new Date().toISOString(),
      });
      expect(second.totalDistanceMeters).toBe(550);
      expect(second.newlyUnlockedTaskIds).toEqual([questTaskId]);

      const duplicate = await store.recordExplorationEvent(explorerUid, {
        eventKey: secondEventKey,
        latitude: 25.034,
        longitude: 121.566,
        accuracyMeters: 15,
        distanceMeters: 250,
        occurredAt: new Date().toISOString(),
      });
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.totalDistanceMeters).toBe(550);
      expect(
        (await store.listTasks(explorerUid)).some(
          (task) => task.title === "走出第一個五百公尺",
        ),
      ).toBe(true);

      const receipts = await prisma.locationEventReceipt.findMany({
        where: { user: { firebaseUid: explorerUid } },
      });
      expect(receipts.every((receipt) => receipt.coarseCell.length > 0)).toBe(
        true,
      );
    },
    30_000,
  );
});
