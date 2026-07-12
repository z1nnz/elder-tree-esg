import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { LineMessagingService } from "./line-messaging.service";

describe("LineMessagingService", () => {
  const previousSecret = process.env.LINE_CHANNEL_SECRET;

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.LINE_CHANNEL_SECRET;
    } else {
      process.env.LINE_CHANNEL_SECRET = previousSecret;
    }
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  });

  it("verifies LINE webhook signatures against the raw body", () => {
    process.env.LINE_CHANNEL_SECRET = "line-secret";
    const body = Buffer.from(JSON.stringify({ events: [] }));
    const signature = createHmac("sha256", "line-secret")
      .update(body)
      .digest("base64");

    const service = new LineMessagingService();

    expect(service.verifySignature(body, signature)).toBe(true);
    expect(service.verifySignature(body, "bad-signature")).toBe(false);
  });

  it("skips push calls when the channel access token is not configured", async () => {
    const service = new LineMessagingService();

    await expect(service.push("Uline", "測試")).resolves.toMatchObject({
      status: "SKIPPED",
    });
  });
});
