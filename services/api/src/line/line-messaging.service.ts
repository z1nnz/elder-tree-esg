import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

type LineMessage = {
  type: "text";
  text: string;
  quickReply?: {
    items: Array<{
      type: "action";
      action: {
        type: "message";
        label: string;
        text: string;
      };
    }>;
  };
};

@Injectable()
export class LineMessagingService {
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) return false;
    if (!rawBody || !signature) return false;
    const digest = createHmac("sha256", channelSecret)
      .update(rawBody)
      .digest("base64");
    const received = Buffer.from(signature);
    const expected = Buffer.from(digest);
    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }

  async reply(replyToken: string, text: string, quickReplies?: string[]) {
    return this.postLineApi("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [this.text(text, quickReplies)],
    });
  }

  async push(lineUserId: string, text: string, quickReplies?: string[]) {
    return this.postLineApi("https://api.line.me/v2/bot/message/push", {
      to: lineUserId,
      messages: [this.text(text, quickReplies)],
    });
  }

  private text(text: string, quickReplies?: string[]): LineMessage {
    if (!quickReplies?.length) return { type: "text", text };
    return {
      type: "text",
      text,
      quickReply: {
        items: quickReplies.slice(0, 13).map((label) => ({
          type: "action",
          action: { type: "message", label, text: label },
        })),
      },
    };
  }

  private async postLineApi(url: string, body: unknown) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      return {
        status: "SKIPPED" as const,
        error: "LINE_CHANNEL_ACCESS_TOKEN is not configured",
      };
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${channelAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    }).catch((error: unknown) => ({
      ok: false,
      text: async () =>
        error instanceof Error ? error.message : "LINE request failed",
    }));
    if (!response.ok) {
      return {
        status: "FAILED" as const,
        error: await response.text(),
      };
    }
    return { status: "SENT" as const, error: null };
  }
}
