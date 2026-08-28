import {
  Body,
  Controller,
  Get,
  GoneException,
  Header,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ClaimDeviceDto,
  DeviceCommandDto,
  DeviceEventDto,
} from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";
import { DeviceSyncService } from "../devices/device-sync.service";

const usesPersistentState = () =>
  process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "false";

@ApiTags("devices")
@ApiBearerAuth()
@Controller("devices")
export class DevicesController {
  constructor(
    private readonly store: DemoStoreService,
    private readonly persistentStore: PersistentStoreService,
    private readonly devices: DeviceSyncService,
  ) {}

  @Get()
  async listDevices(@Req() request: AuthenticatedRequest) {
    if (usesPersistentState()) {
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
    if (usesPersistentState()) {
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
  @Header("Cache-Control", "no-store")
  async getState(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    if (usesPersistentState())
      return { data: await this.devices.stateForMember(request.user!.uid, id) };
    return { data: this.store.getDeviceState(id) };
  }

  @Post(":id/commands")
  @Header("Cache-Control", "no-store")
  async command(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: DeviceCommandDto,
  ) {
    if (usesPersistentState())
      return {
        data: await this.devices.settingsForMember(request.user!.uid, id, body),
      };
    return {
      data: this.store.commandDevice(id, {
        brightness: body.brightness,
        messagePreview: body.messagePreview === null ? "" : body.messagePreview,
      }),
    };
  }

  @Post(":id/events")
  ingestEvent(@Param("id") id: string, @Body() dto: DeviceEventDto) {
    if (usesPersistentState())
      throw new GoneException(
        "Use authenticated device sync protocol version 2",
      );
    return { data: this.store.ingestDeviceEvent(id, dto) };
  }
}
