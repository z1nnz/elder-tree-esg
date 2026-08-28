import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deviceSyncReplySchema } from "@elder-tree/contracts";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "../store/persistent-store.service";
import { DeviceSyncService } from "./device-sync.service";

describe.runIf(
  Boolean(process.env.DATABASE_URL) &&
    process.env.RUN_PERSISTENCE_TESTS === "true",
)("durable circle device synchronization", () => {
  let prisma: PrismaService;
  let app: INestApplication;
  let baseUrl: string;
  let service: DeviceSyncService;
  let now: Date;
  let clock: ClockService;
  let circleId: string;
  let otherCircleId: string;
  let userId: string;
  let uid: string;
  let outsiderUid: string;
  let deviceId: string;
  let thingName: string;
  let actionId: string;
  let runId: string;
  let chapterIds: string[];
  let taskIds: string[];
  const devices: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    // Real Nest build output preserves DI/decorator metadata. Build the API first.
    const require = createRequire(import.meta.url);
    const { NestFactory } = require("@nestjs/core");
    const { AppModule } = require(
      fileURLToPath(new URL("../../dist/app.module.js", import.meta.url)),
    );
    const { ClockService: CompiledClock } = require(
      fileURLToPath(
        new URL("../../dist/time/clock.service.js", import.meta.url),
      ),
    );
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    vi.spyOn(app.get(CompiledClock), "now").mockImplementation(() => now);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });
  beforeEach(async () => {
    // An isolated past season does not replace other suites' current season.
    now = new Date("2000-01-01T00:00:00.000Z");
    clock = { now: () => now };
    service = new DeviceSyncService(prisma, clock);
    uid = `device-member-${randomUUID()}`;
    outsiderUid = `device-outsider-${randomUUID()}`;
    circleId = (
      await prisma.household.create({
        data: {
          name: "一起走的樹伴圈",
          trees: {
            create: { name: "我們的生命樹", growthPoints: 42, stage: "SPROUT" },
          },
        },
      })
    ).id;
    otherCircleId = (
      await prisma.household.create({
        data: { name: "其他樹伴圈", trees: { create: { name: "別人的樹" } } },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          firebaseUid: uid,
          displayName: "測試成員",
          role: "PARTICIPANT",
          activeHouseholdId: circleId,
          householdLinks: {
            create: { householdId: circleId, relationship: "朋友" },
          },
        },
      })
    ).id;
    await prisma.user.create({
      data: {
        firebaseUid: outsiderUid,
        displayName: "其他成員",
        role: "PARTICIPANT",
        activeHouseholdId: otherCircleId,
        householdLinks: {
          create: { householdId: otherCircleId, relationship: "朋友" },
        },
      },
    });
    thingName = `SYNC-${randomUUID()}`;
    deviceId = (
      await prisma.device.create({
        data: {
          thingName,
          serialNumber: thingName,
          claimCodeHash: "test-only",
          householdId: circleId,
          firmwareVersion: "test-2",
        },
      })
    ).id;
    devices.push(deviceId);
    const action = await prisma.cooperativeAction.create({
      data: {
        slug: `device-season-${randomUUID()}`,
        title: "讓春天回到生命樹",
        description: "隔離測試旅程",
        kind: "RELAY",
        status: "PUBLISHED",
        growthPoints: 120,
        keepsakeName: "春季枝條",
        startsAt: now,
        endsAt: new Date("2000-01-02T00:00:00Z"),
        publishedAt: new Date("1999-12-01T00:00:00Z"),
        chapters: {
          create: ["陽光", "水", "新芽"].map((elementName, index) => ({
            sequence: index + 1,
            elementName,
            task: {
              create: {
                title: `一起找${elementName}`,
                description: "不安排實際外出的測試",
                verificationMode: "SELF_CHECK",
                verificationRule: {},
                growthPoints: 0,
              },
            },
          })),
        },
      },
      include: { chapters: { orderBy: { sequence: "asc" } } },
    });
    actionId = action.id;
    chapterIds = action.chapters.map((chapter) => chapter.id);
    taskIds = action.chapters.map((chapter) => chapter.taskId);
    runId = (
      await prisma.cooperativeActionRun.create({
        data: { actionId, householdId: circleId, startedAt: now },
      })
    ).id;
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await prisma.device.deleteMany({
      where: { id: { in: devices.splice(0) } },
    });
    await prisma.cooperativeAction.delete({ where: { id: actionId } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.user.deleteMany({
      where: { firebaseUid: { in: [uid, outsiderUid] } },
    });
    await prisma.household.deleteMany({
      where: { id: { in: [circleId, otherCircleId] } },
    });
  });
  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  const event = (
    eventType:
      "STATE_REQUEST" | "STATE_APPLIED" | "BUTTON_CONFIRM" = "STATE_REQUEST",
  ) => ({
    protocolVersion: 2 as const,
    eventKey: randomUUID(),
    eventType,
    occurredAt: now.toISOString(),
    firmwareVersion: "2.0.0-test",
    queueDepth: 0,
  });

  it("persists a coherent snapshot and does not change its revision on read or restart", async () => {
    const first = await service.stateForMember(uid, deviceId);
    expect(first.desired).toMatchObject({
      revision: 1,
      circle: { id: circleId },
      tree: { growthPoints: 42 },
      journey: {
        completedChapters: 0,
        totalChapters: 3,
        currentChapter: { sequence: 1, claimState: "AVAILABLE" },
      },
    });
    expect(first.desired.messagePreview).toBeNull();
    expect(first.reported).toMatchObject({
      online: false,
      synchronized: false,
    });
    expect(
      (await new DeviceSyncService(prisma, clock).stateForMember(uid, deviceId))
        .desired,
    ).toEqual(first.desired);
    await prisma.cooperativeActionRun.delete({ where: { id: runId } });
    expect(
      (await service.stateForMember(uid, deviceId)).desired.journey,
    ).toBeNull();
    expect(
      await prisma.cooperativeActionRun.count({
        where: { householdId: circleId },
      }),
    ).toBe(0);
  });

  it("denies cross-circle, removed-member and unclaimed-device access", async () => {
    await expect(service.stateForMember(outsiderUid, deviceId)).rejects.toThrow(
      "Device not found in active circle",
    );
    await expect(
      service.settingsForMember(outsiderUid, deviceId, {
        expectedRevision: 1,
        brightness: 80,
      }),
    ).rejects.toThrow("Device not found in active circle");
    await prisma.householdMember.delete({
      where: { householdId_userId: { householdId: circleId, userId } },
    });
    await expect(service.stateForMember(uid, deviceId)).rejects.toThrow(
      "Device not found in active circle",
    );
    await prisma.device.update({
      where: { id: deviceId },
      data: { householdId: null },
    });
    await expect(service.ingest(thingName, event())).rejects.toThrow(
      "Claimed device not found",
    );
  });

  it("does not carry private messages into a different circle after reprovisioning", async () => {
    const state = (await service.stateForMember(uid, deviceId)).desired;
    await service.settingsForMember(uid, deviceId, {
      expectedRevision: state.revision,
      messagePreview: "只給原樹伴圈的留言",
    });
    await prisma.device.update({
      where: { id: deviceId },
      data: { householdId: otherCircleId },
    });
    const moved = (await service.stateForMember(outsiderUid, deviceId)).desired;
    expect(moved.circle.id).toBe(otherCircleId);
    expect(moved.messagePreview).toBeNull();
    expect(moved.revision).toBeGreaterThan(state.revision);
    await expect(service.stateForMember(uid, deviceId)).rejects.toThrow(
      "Device not found in active circle",
    );
  });

  it("projects contributions, claim expiry and completion without changing the journey", async () => {
    await prisma.cooperativeActionContribution.create({
      data: {
        runId,
        chapterId: chapterIds[0],
        taskId: taskIds[0],
        userId,
        idempotencyKey: randomUUID(),
        witnessedAt: now,
      },
    });
    await prisma.cooperativeActionRun.update({
      where: { id: runId },
      data: {
        claimedChapterId: chapterIds[1],
        claimedById: userId,
        claimedTaskId: taskIds[1],
        claimedAt: now,
        claimExpiresAt: new Date(now.getTime() + 60_000),
      },
    });
    const claimed = (await service.stateForMember(uid, deviceId)).desired;
    expect(claimed.journey).toMatchObject({
      completedChapters: 1,
      currentChapter: { sequence: 2, claimState: "CLAIMED" },
    });
    now = new Date(now.getTime() + 60_000);
    const expired = (await service.stateForMember(uid, deviceId)).desired;
    expect(expired.revision).toBe(claimed.revision + 1);
    expect(expired.journey?.currentChapter?.claimState).toBe("EXPIRED");
    expect(
      (
        await prisma.cooperativeActionRun.findUniqueOrThrow({
          where: { id: runId },
        })
      ).claimedById,
    ).toBe(userId);
    await prisma.cooperativeActionRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", completedAt: now },
    });
    const completed = (await service.stateForMember(uid, deviceId)).desired;
    expect(completed.journey).toMatchObject({
      status: "COMPLETED",
      currentChapter: null,
      keepsakeName: "春季枝條",
    });
  });

  it("allows one concurrent settings change and rejects stale revisions", async () => {
    const first = (await service.stateForMember(uid, deviceId)).desired;
    const results = await Promise.allSettled(
      [60, 80].map((brightness) =>
        service.settingsForMember(uid, deviceId, {
          expectedRevision: first.revision,
          brightness,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const second = (await service.stateForMember(uid, deviceId)).desired;
    expect(second.revision).toBe(first.revision + 1);
    expect(second.commandId).not.toBe(first.commandId);
    await expect(
      service.settingsForMember(uid, deviceId, {
        expectedRevision: first.revision,
        messagePreview: "舊畫面送出的文字",
      }),
    ).rejects.toThrow("Device state changed");
    const message = await service.settingsForMember(uid, deviceId, {
      expectedRevision: second.revision,
      messagePreview: "今天一起看新芽",
    });
    expect(
      (
        await service.settingsForMember(uid, deviceId, {
          expectedRevision: message.revision,
          messagePreview: null,
        })
      ).messagePreview,
    ).toBeNull();
  });

  it("deduplicates concurrent durable delivery without awarding growth", async () => {
    const request = event("BUTTON_CONFIRM");
    const replies = await Promise.all([
      service.ingest(thingName, request),
      service.ingest(thingName, request),
    ]);
    expect(replies.map((reply) => reply.duplicate).sort()).toEqual([
      false,
      true,
    ]);
    for (const reply of replies)
      expect(
        deviceSyncReplySchema.parse(reply).snapshot.tree.growthPoints,
      ).toBe(42);
    expect(await prisma.deviceEvent.count({ where: { deviceId } })).toBe(1);
    expect(
      await prisma.growthEntry.count({
        where: { tree: { householdId: circleId } },
      }),
    ).toBe(0);
    expect(
      (await new DeviceSyncService(prisma, clock).ingest(thingName, request))
        .duplicate,
    ).toBe(true);
    await expect(
      service.ingest(thingName, { ...request, queueDepth: 9 }),
    ).rejects.toThrow("Event key was reused");
  });

  it("only reports synchronized for the exact current revision and command", async () => {
    const first = (await service.ingest(thingName, event())).snapshot;
    expect(
      (await service.stateForMember(uid, deviceId)).reported.synchronized,
    ).toBe(false);
    const ack = {
      ...event("STATE_APPLIED"),
      revision: first.revision,
      commandId: first.commandId,
    };
    expect((await service.ingest(thingName, ack)).applied).toBe(true);
    expect(
      (await service.stateForMember(uid, deviceId)).reported.synchronized,
    ).toBe(true);
    const second = await service.settingsForMember(uid, deviceId, {
      expectedRevision: first.revision,
      brightness: 70,
    });
    expect((await service.ingest(thingName, ack)).applied).toBe(false);
    expect(
      (await service.stateForMember(uid, deviceId)).reported.synchronized,
    ).toBe(false);
    expect(
      (
        await service.ingest(thingName, {
          ...event("STATE_APPLIED"),
          revision: second.revision,
          commandId: randomUUID(),
        })
      ).applied,
    ).toBe(false);
    await expect(
      service.ingest(thingName, {
        ...event("STATE_APPLIED"),
        revision: second.revision + 1,
        commandId: second.commandId,
      }),
    ).rejects.toThrow("future revision");
    expect(
      (
        await service.ingest(thingName, {
          ...event("STATE_APPLIED"),
          revision: second.revision,
          commandId: second.commandId,
        })
      ).applied,
    ).toBe(true);
    now = new Date(now.getTime() + 90_000);
    expect(
      (await service.stateForMember(uid, deviceId)).reported,
    ).toMatchObject({ online: false, synchronized: false });
  });

  it("rejects fabricated fields and invalid times before recording events", async () => {
    await expect(
      service.ingest(thingName, { ...event(), growthPoints: 999 }),
    ).rejects.toThrow("Invalid device event");
    await expect(
      service.ingest(thingName, event("STATE_APPLIED")),
    ).rejects.toThrow("Invalid device event");
    await expect(
      service.ingest(thingName, {
        ...event(),
        occurredAt: "2099-01-01T00:00:00Z",
      }),
    ).rejects.toThrow("outside the accepted window");
    expect(await prisma.deviceEvent.count({ where: { deviceId } })).toBe(0);
  });

  it("uses device-scoped event keys and cannot claim one device into two circles", async () => {
    const pepper = "isolated-claim-test-only";
    const serialNumber = `CLAIM-${randomUUID()}`;
    const claimCode = "12345678";
    vi.stubEnv("DEVICE_CLAIM_PEPPER", pepper);
    const device = await prisma.device.create({
      data: {
        serialNumber,
        thingName: serialNumber,
        firmwareVersion: "2-test",
        claimCodeHash: createHash("sha256")
          .update(`${pepper}\u0000${serialNumber}\u0000${claimCode}`)
          .digest("hex"),
      },
    });
    devices.push(device.id);
    const store = new PersistentStoreService(prisma);
    const claims = await Promise.allSettled(
      [uid, outsiderUid].map((member) =>
        store.claimDevice(member, serialNumber, claimCode),
      ),
    );
    expect(
      claims.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const request = event();
    await service.ingest(thingName, request);
    await service.ingest(serialNumber, request);
    expect(
      await prisma.deviceEvent.count({ where: { eventKey: request.eventKey } }),
    ).toBe(2);
  });

  it("requires the bridge secret on real HTTP and never treats it as a member login", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    const secret = `isolated-device-http-${randomUUID()}`;
    vi.stubEnv("IOT_BRIDGE_SECRET", secret);
    const request = event();
    const post = (credential?: string) =>
      fetch(`${baseUrl}/device-sync/${thingName}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(credential ? { "x-iot-bridge-secret": credential } : {}),
        },
        body: JSON.stringify(request),
      });
    expect((await post()).status).toBe(401);
    expect((await post("not-the-secret")).status).toBe(401);
    expect(await prisma.deviceEvent.count({ where: { deviceId } })).toBe(0);
    const response = await post(secret);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(
      deviceSyncReplySchema.parse((await response.json()).data),
    ).toMatchObject({
      accepted: true,
      duplicate: false,
      snapshot: { deviceId },
    });
    const member = await fetch(`${baseUrl}/devices/${deviceId}/state`, {
      headers: { "x-iot-bridge-secret": secret },
    });
    expect(member.status).toBe(401);
    vi.stubEnv("IOT_BRIDGE_SECRET", "short");
    expect((await post("short")).status).toBe(401);
  });
});
