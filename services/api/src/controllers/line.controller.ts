import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { LineMessagingService } from "../line/line-messaging.service";
import { Public } from "../security/public.decorator";
import { PersistentStoreService } from "../store/persistent-store.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

type LineWebhookBody = {
  events?: Array<{
    type?: string;
    replyToken?: string;
    source?: { userId?: string };
    message?: { type?: string; text?: string };
    postback?: { data?: string };
  }>;
};

@ApiTags("line")
@Public()
@Controller("line")
export class LineController {
  constructor(
    private readonly store: PersistentStoreService,
    private readonly line: LineMessagingService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() request: RawBodyRequest,
    @Headers("x-line-signature") signature: string | undefined,
    @Body() body: LineWebhookBody,
  ) {
    if (!this.line.verifySignature(request.rawBody, signature)) {
      throw new UnauthorizedException("Invalid LINE signature");
    }
    const events = body.events ?? [];
    for (const event of events) {
      await this.handleEvent(event);
    }
    return { data: { ok: true } };
  }

  private async handleEvent(event: NonNullable<LineWebhookBody["events"]>[number]) {
    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;
    if (!lineUserId || !replyToken) return;
    const text =
      event.message?.type === "text" ? event.message.text?.trim() ?? "" : "";
    if (!text) return;
    const normalized = text.toUpperCase();

    if (/^[A-Z0-9]{8}$/.test(normalized)) {
      try {
        const binding = await this.store.bindLineUserWithCode(
          normalized,
          lineUserId,
        );
        const result = await this.line.reply(
          replyToken,
          `綁定完成：${binding.householdName}。之後綠伴會用 LINE 提醒重要任務與待覆核通知。`,
          ["打開 App", "晚點提醒我", "我需要幫忙"],
        );
        await this.store.logLineNotification({
          lineBindingId: binding.id,
          target: lineUserId,
          type: "BINDING_REPLY",
          status: result.status,
          error: result.error,
        });
      } catch {
        const result = await this.line.reply(
          replyToken,
          "這組綁定碼無法使用，可能已過期或已被使用。請回 App 重新產生一次。",
          ["打開 App"],
        );
        await this.store.logLineNotification({
          target: lineUserId,
          type: "BINDING_FAILED_REPLY",
          status: result.status,
          error: result.error,
        });
      }
      return;
    }

    const reply = this.quickReplyText(text);
    const result = await this.line.reply(
      replyToken,
      reply.message,
      reply.quickReplies,
    );
    await this.store.logLineNotification({
      target: lineUserId,
      type: reply.type,
      status: result.status,
      error: result.error,
    });
  }

  private quickReplyText(text: string) {
    if (text.includes("需要幫忙")) {
      return {
        type: "HELP_REQUEST_REPLY",
        message:
          "我收到你的需要幫忙了。第一版會先通知你回到 App；下一版會接上家人與陪伴者通知。",
        quickReplies: ["打開 App", "晚點提醒我"],
      };
    }
    if (text.includes("晚點")) {
      return {
        type: "REMIND_LATER_REPLY",
        message: "好，我晚點再提醒你。今天不用急，慢慢來。",
        quickReplies: ["打開 App", "我需要幫忙"],
      };
    }
    if (text.includes("完成")) {
      return {
        type: "COMPLETE_INTENT_REPLY",
        message:
          "收到。為了確保生命樹成長不重複，請回 App 按下任務完成；照片任務也會在 App 裡驗證。",
        quickReplies: ["打開 App", "晚點提醒我"],
      };
    }
    if (text.includes("APP") || text.includes("打開")) {
      return {
        type: "OPEN_APP_REPLY",
        message: "請打開綠伴 App，今天的任務與生命樹都在那裡。",
        quickReplies: ["我完成了", "我需要幫忙"],
      };
    }
    return {
      type: "GENERAL_REPLY",
      message:
        "這裡是綠伴 LINE 陪伴入口。你可以輸入綁定碼，或回覆：我完成了、晚點提醒我、我需要幫忙、打開 App。",
      quickReplies: ["我完成了", "晚點提醒我", "我需要幫忙", "打開 App"],
    };
  }
}
