import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class DeviceBridgeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = process.env.IOT_BRIDGE_SECRET;
    const received = request.header("x-iot-bridge-secret");
    if (
      !configured ||
      configured.length < 32 ||
      !received ||
      received.length > 512
    ) {
      throw new UnauthorizedException("Device bridge authentication required");
    }
    const digest = (value: string) =>
      createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(configured), digest(received))) {
      throw new UnauthorizedException("Device bridge authentication required");
    }
    return true;
  }
}
