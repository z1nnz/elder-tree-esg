import {
  Body,
  Controller,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { DeviceSyncService } from "../devices/device-sync.service";
import { DeviceBridgeGuard } from "../security/device-bridge.guard";
import { Public } from "../security/public.decorator";

@Controller("device-sync")
export class DeviceSyncController {
  constructor(private readonly devices: DeviceSyncService) {}

  // Public bypasses Firebase only: this route always requires the bridge guard.
  // Only the trusted IoT gateway may supply the certificate-bound thing name.
  @Post(":thingName/events")
  @Public()
  @UseGuards(DeviceBridgeGuard)
  @Header("Cache-Control", "no-store")
  async event(@Param("thingName") thingName: string, @Body() body: unknown) {
    return { data: await this.devices.ingest(thingName, body) };
  }
}
