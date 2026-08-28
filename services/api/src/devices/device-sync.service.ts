import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma, type Device } from "@prisma/client";
import {
  deviceSettingsSchema,
  deviceSnapshotSchema,
  deviceSyncEventSchema,
  type DeviceSettings,
  type DeviceSnapshot,
  type DeviceSyncReply,
} from "@elder-tree/contracts";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";

type Transaction = Prisma.TransactionClient;
const text = (value: string, limit: number) => {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > limit) break;
    result += character;
  }
  return result;
};

@Injectable()
export class DeviceSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  // A snapshot must not mix tree growth from one transaction with relay progress
  // from another. Retry only actual serialization failures, never arbitrary errors.
  private async transaction<T>(
    operation: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: "Serializable",
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034" ||
          attempt >= 4
        )
          throw error;
      }
    }
  }

  private async memberDevice(tx: Transaction, uid: string, deviceId: string) {
    const user = await tx.user.findUnique({
      where: { firebaseUid: uid },
      select: { id: true, activeHouseholdId: true },
    });
    if (!user?.activeHouseholdId)
      throw new NotFoundException("Device not found in active circle");
    const device = await tx.device.findFirst({
      where: {
        id: deviceId,
        householdId: user.activeHouseholdId,
        household: { members: { some: { userId: user.id } } },
      },
    });
    if (!device)
      throw new NotFoundException("Device not found in active circle");
    return device;
  }

  async stateForMember(uid: string, deviceId: string) {
    return this.transaction(async (tx) => {
      const device = await this.memberDevice(tx, uid, deviceId);
      const snapshot = await this.snapshot(tx, device);
      const reported = (device.reportedState ?? {}) as Record<string, unknown>;
      const online =
        device.lastSeenAt !== null &&
        this.clock.now().getTime() - device.lastSeenAt.getTime() < 90_000;
      return {
        desired: snapshot,
        reported: {
          online,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          firmwareVersion: device.firmwareVersion,
          acknowledgedRevision: reported.acknowledgedRevision ?? null,
          acknowledgedCommandId: reported.acknowledgedCommandId ?? null,
          synchronized:
            online &&
            reported.acknowledgedRevision === snapshot.revision &&
            reported.acknowledgedCommandId === snapshot.commandId,
        },
      };
    });
  }

  async settingsForMember(uid: string, deviceId: string, input: unknown) {
    const parsed = deviceSettingsSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException("Invalid device settings");
    return this.transaction(async (tx) => {
      let device = await this.memberDevice(tx, uid, deviceId);
      const current = await this.snapshot(tx, device);
      if (current.revision !== parsed.data.expectedRevision)
        throw new ConflictException(
          "Device state changed; refresh before changing settings",
        );
      device = await tx.device.findUniqueOrThrow({ where: { id: deviceId } });
      return this.snapshot(tx, device, parsed.data);
    });
  }

  async ingest(thingName: string, input: unknown): Promise<DeviceSyncReply> {
    const parsed = deviceSyncEventSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid device event");
    const event = parsed.data;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(event))
      .digest("hex");
    return this.transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { thingName } });
      if (!device?.householdId)
        throw new NotFoundException("Claimed device not found");
      const previous = await tx.deviceEvent.findUnique({
        where: {
          deviceId_eventKey: { deviceId: device.id, eventKey: event.eventKey },
        },
      });
      if (
        previous &&
        (previous.payload as Record<string, unknown>).fingerprint !==
          fingerprint
      ) {
        throw new ConflictException("Event key was reused with different data");
      }
      const now = this.clock.now();
      // Durable retries remain valid after the original offline window closes.
      const age = now.getTime() - new Date(event.occurredAt).getTime();
      if (!previous && (age > 7 * 24 * 60 * 60_000 || age < -5 * 60_000)) {
        throw new BadRequestException(
          "Device event time is outside the accepted window",
        );
      }
      const snapshot = await this.snapshot(tx, device);
      if (
        event.eventType === "STATE_APPLIED" &&
        event.revision! > snapshot.revision
      ) {
        throw new ConflictException(
          "Device cannot acknowledge a future revision",
        );
      }
      const applied =
        event.eventType === "STATE_APPLIED" &&
        event.revision === snapshot.revision &&
        event.commandId === snapshot.commandId;
      const reported = (device.reportedState ?? {}) as Record<
        string,
        Prisma.InputJsonValue
      >;
      if (!previous) {
        await tx.deviceEvent.create({
          data: {
            deviceId: device.id,
            eventKey: event.eventKey,
            eventType: event.eventType,
            occurredAt: new Date(event.occurredAt),
            payload: { fingerprint, event },
          },
        });
      }
      // Replays acknowledge delivery, but cannot regress state or spoof new telemetry.
      await tx.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: now,
          ...(!previous
            ? {
                firmwareVersion: event.firmwareVersion,
                reportedState: {
                  ...reported,
                  online: true,
                  firmwareVersion: event.firmwareVersion,
                  queueDepth: event.queueDepth,
                  updatedAt: now.toISOString(),
                  ...(applied
                    ? {
                        acknowledgedRevision: snapshot.revision,
                        acknowledgedCommandId: snapshot.commandId,
                      }
                    : {}),
                },
              }
            : {}),
        },
      });
      return {
        accepted: true,
        eventKey: event.eventKey,
        duplicate: Boolean(previous),
        applied,
        serverTime: now.toISOString(),
        refreshAfterSeconds: 30,
        staleAfterSeconds: 90,
        snapshot,
      };
    });
  }

  private async snapshot(
    tx: Transaction,
    device: Device,
    settings?: DeviceSettings,
  ): Promise<DeviceSnapshot> {
    if (!device.householdId)
      throw new NotFoundException("Claimed device not found");
    const now = this.clock.now();
    const circle = await tx.household.findUniqueOrThrow({
      where: { id: device.householdId },
    });
    const tree = await tx.tree.findFirst({
      where: { householdId: circle.id },
      orderBy: { createdAt: "asc" },
    });
    if (!tree) throw new NotFoundException("Circle tree not found");
    // Matches the App's current published season. Reading hardware state never
    // creates a run, claims a chapter, completes an action or awards growth.
    const action = await tx.cooperativeAction.findFirst({
      where: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { publishedAt: "asc" },
    });
    const run = action
      ? await tx.cooperativeActionRun.findUnique({
          where: {
            actionId_householdId: {
              actionId: action.id,
              householdId: circle.id,
            },
          },
          include: {
            action: {
              include: {
                chapters: {
                  include: { task: true },
                  orderBy: { sequence: "asc" },
                },
              },
            },
            contributions: { select: { chapterId: true } },
            claimedTask: { select: { title: true } },
          },
        })
      : null;
    const completed = new Set(
      run?.contributions.map((entry) => entry.chapterId),
    );
    const chapter =
      run?.status === "ACTIVE"
        ? run.action.chapters.find((entry) => !completed.has(entry.id))
        : undefined;
    const claimed = Boolean(
      chapter &&
      run?.claimedChapterId === chapter.id &&
      run.claimedById &&
      run.claimExpiresAt,
    );
    const previous = deviceSnapshotSchema.safeParse(device.syncState);
    const sameCircle =
      previous.success && previous.data.circle.id === circle.id;
    const oldSettings = (device.desiredState ?? {}) as Record<string, unknown>;
    const content = {
      protocolVersion: 2 as const,
      deviceId: device.id,
      circle: { id: circle.id, name: text(circle.name, 80) },
      tree: {
        name: text(tree.name, 80),
        stage: tree.stage,
        growthPoints: tree.growthPoints,
      },
      journey: run
        ? {
            runId: run.id,
            title: text(run.action.title, 80),
            kind: run.action.kind,
            status: run.status,
            completedChapters: completed.size,
            totalChapters: run.action.chapters.length,
            keepsakeName: text(run.action.keepsakeName, 80),
            currentChapter: chapter
              ? {
                  sequence: chapter.sequence,
                  title: text(
                    claimed && run.claimedTask
                      ? run.claimedTask.title
                      : chapter.task.title,
                    80,
                  ),
                  elementName: text(chapter.elementName, 40),
                  claimState: claimed
                    ? run.claimExpiresAt!.getTime() > now.getTime()
                      ? "CLAIMED"
                      : "EXPIRED"
                    : "AVAILABLE",
                  claimExpiresAt: claimed
                    ? run.claimExpiresAt!.toISOString()
                    : null,
                }
              : null,
          }
        : null,
      messagePreview:
        settings?.messagePreview !== undefined
          ? settings.messagePreview
          : sameCircle && previous.success
            ? previous.data.messagePreview
            : null,
      brightness:
        settings?.brightness ??
        (previous.success
          ? previous.data.brightness
          : typeof oldSettings.brightness === "number" &&
              Number.isInteger(oldSettings.brightness)
            ? Math.max(5, Math.min(100, oldSettings.brightness))
            : 65),
    };
    if (previous.success && previous.data.revision === device.syncRevision) {
      const {
        revision: _revision,
        commandId: _command,
        generatedAt: _time,
        ...oldContent
      } = previous.data;
      if (isDeepStrictEqual(content, oldContent)) return previous.data;
    }
    const snapshot = deviceSnapshotSchema.parse({
      ...content,
      revision: device.syncRevision + 1,
      commandId: randomUUID(),
      generatedAt: now.toISOString(),
    });
    await tx.device.update({
      where: { id: device.id },
      data: {
        syncRevision: snapshot.revision,
        syncState: snapshot,
        desiredState: {
          activeTaskId: null,
          activeTaskTitle: snapshot.journey?.currentChapter?.title ?? null,
          messagePreview: snapshot.messagePreview,
          treeStage: snapshot.tree.stage,
          growthPoints: snapshot.tree.growthPoints,
          brightness: snapshot.brightness,
          ledScene: snapshot.messagePreview
            ? "MESSAGE"
            : snapshot.journey?.status === "COMPLETED"
              ? "GROWTH"
              : "IDLE",
          firmwareTarget: null,
          commandId: snapshot.commandId,
          updatedAt: snapshot.generatedAt,
        },
      },
    });
    return snapshot;
  }
}
