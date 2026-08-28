import { describe, expect, it } from "vitest";
import { deviceSettingsSchema, deviceSyncEventSchema } from "./device-sync";

describe("device protocol v2", () => {
  const event = {
    protocolVersion: 2,
    eventKey: "11111111-1111-4111-8111-111111111111",
    eventType: "STATE_REQUEST",
    occurredAt: "2026-08-28T00:00:00Z",
    firmwareVersion: "2-test",
    queueDepth: 0,
  };
  it("rejects extra reward data, unsafe settings and acknowledgments attached to buttons", () => {
    expect(
      deviceSyncEventSchema.safeParse({ ...event, growthPoints: 100 }).success,
    ).toBe(false);
    expect(
      deviceSyncEventSchema.safeParse({
        ...event,
        eventType: "BUTTON_CONFIRM",
        revision: 1,
      }).success,
    ).toBe(false);
    expect(
      deviceSettingsSchema.safeParse({ expectedRevision: 1, brightness: 101 })
        .success,
    ).toBe(false);
    expect(
      deviceSettingsSchema.safeParse({ expectedRevision: 1 }).success,
    ).toBe(false);
    expect(deviceSettingsSchema.safeParse({ brightness: 80 }).success).toBe(
      false,
    );
  });
  it("requires exact acknowledgment identity and permits explicit message removal", () => {
    expect(
      deviceSyncEventSchema.safeParse({ ...event, eventType: "STATE_APPLIED" })
        .success,
    ).toBe(false);
    expect(
      deviceSyncEventSchema.safeParse({
        ...event,
        eventType: "STATE_APPLIED",
        revision: 1,
        commandId: event.eventKey,
      }).success,
    ).toBe(true);
    expect(
      deviceSettingsSchema.parse({ expectedRevision: 1, messagePreview: null })
        .messagePreview,
    ).toBeNull();
  });
});
