import { describe, expect, it } from "vitest";
import { parseDeviceEvent } from "./index";

describe("parseDeviceEvent", () => {
  it("accepts a supported device event", () => {
    const event = parseDeviceEvent({
      deviceId: "device-1",
      eventKey: "device-1:42",
      eventType: "BUTTON_CONFIRM",
      occurredAt: "2026-07-04T12:00:00.000Z",
      payload: { queueDepth: 2 },
    });
    expect(event.eventType).toBe("BUTTON_CONFIRM");
  });

  it("rejects unknown event types", () => {
    expect(() =>
      parseDeviceEvent({
        deviceId: "device-1",
        eventKey: "device-1:42",
        eventType: "CAMERA_CAPTURE",
        occurredAt: "2026-07-04T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
