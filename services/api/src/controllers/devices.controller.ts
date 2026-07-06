import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ClaimDeviceDto, DeviceCommandDto, DeviceEventDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("devices")
@ApiBearerAuth()
@Controller("devices")
export class DevicesController {
  constructor(
    private readonly store: DemoStoreService,
    private readonly persistentStore: PersistentStoreService,
  ) {}

  @Get()
  async listDevices(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE === "false") {
      return {
        data: await this.persistentStore.listDevices(request.user!.uid),
      };
    }
    return { data: this.store.listDevices() };
  }

  @Post("claim")
  async claimDevice(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ClaimDeviceDto,
  ) {
    if (process.env.DEMO_MODE === "false") {
      return {
        data: await this.persistentStore.claimDevice(
          request.user!.uid,
          dto.serialNumber,
          dto.claimCode,
        ),
      };
    }
    return { data: this.store.claimDevice(dto.serialNumber, dto.claimCode) };
  }

  @Get(":id/state")
  getState(@Param("id") id: string) {
    return { data: this.store.getDeviceState(id) };
  }

  @Post(":id/commands")
  command(@Param("id") id: string, @Body() dto: DeviceCommandDto) {
    return { data: this.store.commandDevice(id, dto) };
  }

  @Post(":id/events")
  ingestEvent(
    @Param("id") id: string,
    @Body() dto: DeviceEventDto,
    @Headers("x-iot-bridge-secret") secret?: string,
  ) {
    if (
      process.env.DEMO_MODE === "false" &&
      (!process.env.IOT_BRIDGE_SECRET || secret !== process.env.IOT_BRIDGE_SECRET)
    ) {
      throw new UnauthorizedException("Invalid IoT bridge secret");
    }
    return { data: this.store.ingestDeviceEvent(id, dto) };
  }
}
