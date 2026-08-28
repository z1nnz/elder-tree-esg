import { z } from "zod";

const uuid = z.string().uuid();
const revision = z.number().int().min(1).max(2_147_483_647);
const chapter = z
  .object({
    sequence: z.number().int().positive(),
    title: z.string().max(80),
    elementName: z.string().max(40),
    claimState: z.enum(["AVAILABLE", "CLAIMED", "EXPIRED"]),
    claimExpiresAt: z.string().datetime().nullable(),
  })
  .strict();

// Version 2 is a complete snapshot, never an AWS Shadow partial delta.
export const deviceSnapshotSchema = z
  .object({
    protocolVersion: z.literal(2),
    deviceId: uuid,
    revision,
    commandId: uuid,
    generatedAt: z.string().datetime(),
    circle: z.object({ id: uuid, name: z.string().max(80) }).strict(),
    tree: z
      .object({
        name: z.string().max(80),
        stage: z.enum(["SEED", "SPROUT", "SEEDLING", "YOUNG_TREE", "MATURE"]),
        growthPoints: z.number().int().nonnegative(),
      })
      .strict(),
    journey: z
      .object({
        runId: uuid,
        title: z.string().max(80),
        kind: z.enum(["COLLECTION", "RELAY"]),
        status: z.enum(["ACTIVE", "COMPLETED", "EXPIRED"]),
        completedChapters: z.number().int().nonnegative(),
        totalChapters: z.number().int().nonnegative(),
        currentChapter: chapter.nullable(),
        keepsakeName: z.string().max(80),
      })
      .strict()
      .nullable(),
    messagePreview: z.string().max(120).nullable(),
    brightness: z.number().int().min(5).max(100),
  })
  .strict();
export type DeviceSnapshot = z.infer<typeof deviceSnapshotSchema>;

export const deviceSettingsSchema = z
  .object({
    expectedRevision: revision,
    brightness: z.number().int().min(5).max(100).optional(),
    messagePreview: z.string().max(120).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.brightness !== undefined || value.messagePreview !== undefined,
    "Provide a setting to change",
  );
export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;

export const deviceSyncEventSchema = z
  .object({
    protocolVersion: z.literal(2),
    eventKey: uuid,
    eventType: z.enum([
      "STATE_REQUEST",
      "STATE_APPLIED",
      "BUTTON_JOURNEY",
      "BUTTON_MESSAGE",
      "BUTTON_CONFIRM",
    ]),
    occurredAt: z.string().datetime(),
    firmwareVersion: z.string().min(1).max(32),
    queueDepth: z.number().int().min(0).max(100),
    revision: revision.optional(),
    commandId: uuid.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.eventType === "STATE_APPLIED" &&
      (!value.revision || !value.commandId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Applied state requires its exact revision and command ID",
      });
    }
    if (
      value.eventType !== "STATE_APPLIED" &&
      (value.revision !== undefined || value.commandId !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only STATE_APPLIED can acknowledge state",
      });
    }
  });
export type DeviceSyncEvent = z.infer<typeof deviceSyncEventSchema>;

export const deviceSyncReplySchema = z
  .object({
    accepted: z.literal(true),
    eventKey: uuid,
    duplicate: z.boolean(),
    applied: z.boolean(),
    serverTime: z.string().datetime(),
    refreshAfterSeconds: z.literal(30),
    staleAfterSeconds: z.literal(90),
    snapshot: deviceSnapshotSchema,
  })
  .strict();
export type DeviceSyncReply = z.infer<typeof deviceSyncReplySchema>;
