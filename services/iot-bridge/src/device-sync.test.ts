import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createDeviceSyncHandler } from "./device-sync";

const secret = "local-device-bridge-test-secret-only";
function fixture() {
  const event = {
    protocolVersion: 2,
    eventKey: randomUUID(),
    eventType: "STATE_REQUEST",
    occurredAt: "2026-08-28T00:00:00Z",
    firmwareVersion: "2-test",
    queueDepth: 0,
  };
  const input = {
    authenticatedThingName: "TREE-TEST",
    topicThingName: "TREE-TEST",
    event,
  };
  const reply = {
    accepted: true,
    eventKey: event.eventKey,
    duplicate: false,
    applied: false,
    serverTime: event.occurredAt,
    refreshAfterSeconds: 30,
    staleAfterSeconds: 90,
    snapshot: {
      protocolVersion: 2,
      deviceId: randomUUID(),
      revision: 1,
      commandId: randomUUID(),
      generatedAt: event.occurredAt,
      circle: { id: randomUUID(), name: "測試樹伴圈" },
      tree: { name: "共同生命樹", stage: "SEED", growthPoints: 0 },
      journey: null,
      messagePreview: null,
      brightness: 65,
    },
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ data: reply }));
  const publish = vi
    .fn<(topic: string, body: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  const handler = createDeviceSyncHandler({
    apiUrl: "https://api.example.test/api/v1",
    secret,
    fetch: fetcher,
    publish,
  });
  return { event, input, reply, fetcher, publish, handler };
}

describe("certificate-bound device gateway", () => {
  it("routes by trusted connection metadata and publishes only after persistence", async () => {
    const { handler, input, reply, fetcher, publish } = fixture();
    await expect(handler(input)).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://api.example.test/api/v1/device-sync/TREE-TEST/events",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      headers: { "x-iot-bridge-secret": secret },
    });
    expect(publish).toHaveBeenCalledWith(
      "tree/TREE-TEST/sync/reply",
      JSON.stringify(reply),
    );
    expect(fetcher.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0],
    );
  });
  it("rejects forged topic or payload identity before reaching the API", async () => {
    const { handler, input, fetcher, publish } = fixture();
    await expect(
      handler({ ...input, topicThingName: "OTHER-TREE" }),
    ).rejects.toThrow("does not match");
    await expect(
      handler({ ...input, event: { ...input.event, deviceId: randomUUID() } }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
  it("does not acknowledge an API rejection or a response for another event", async () => {
    const { handler, input, reply, fetcher, publish } = fixture();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(handler(input)).rejects.toThrow("503");
    fetcher.mockResolvedValueOnce(
      Response.json({ data: { ...reply, eventKey: randomUUID() } }),
    );
    await expect(handler(input)).rejects.toThrow("different event");
    expect(publish).not.toHaveBeenCalled();
  });
  it("retries the same durable event when MQTT acknowledgment delivery fails", async () => {
    const { handler, input, reply, fetcher, publish } = fixture();
    publish.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(handler(input)).rejects.toThrow("network unavailable");
    reply.duplicate = true;
    await expect(handler(input)).resolves.toMatchObject({ duplicate: true });
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
    expect(publish).toHaveBeenCalledTimes(2);
  });
  it("rejects insecure or credential-bearing API addresses and short secrets", () => {
    const { fetcher, publish } = fixture();
    for (const apiUrl of [
      "http://api.example.test",
      "https://user:password@api.example.test",
      "https://api.example.test?token=secret",
    ]) {
      expect(() =>
        createDeviceSyncHandler({ apiUrl, secret, fetch: fetcher, publish }),
      ).toThrow("requires HTTPS");
    }
    expect(() =>
      createDeviceSyncHandler({
        apiUrl: "https://api.example.test",
        secret: "short",
        fetch: fetcher,
        publish,
      }),
    ).toThrow("32 characters");
  });
});
