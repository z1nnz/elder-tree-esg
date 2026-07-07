import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ExplorationEventDto,
  CompleteRadarMissionDto,
  RadarMissionEventDto,
  StartExplorationSessionDto,
} from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("exploration")
@ApiBearerAuth()
@Controller("exploration")
export class ExplorationController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("state")
  async state(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.store.getExplorationState(request.user!.uid),
    };
  }

  @Get("radar")
  async radar(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.store.getRadarState(request.user!.uid),
    };
  }

  @Post("radar/:missionId/unlock")
  async unlockRadarMission(
    @Req() request: AuthenticatedRequest,
    @Param("missionId") missionId: string,
    @Body() dto: RadarMissionEventDto,
  ) {
    return {
      data: await this.store.unlockRadarMission(
        request.user!.uid,
        missionId,
        dto,
      ),
    };
  }

  @Post("radar/:missionId/complete")
  async completeRadarMission(
    @Req() request: AuthenticatedRequest,
    @Param("missionId") missionId: string,
    @Body() dto: CompleteRadarMissionDto,
  ) {
    return {
      data: await this.store.completeRadarMission(
        request.user!.uid,
        missionId,
        dto.idempotencyKey,
      ),
    };
  }

  @Post("sessions")
  async startSession(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartExplorationSessionDto,
  ) {
    return {
      data: await this.store.startExplorationSession(
        request.user!.uid,
        dto.routeId,
      ),
    };
  }

  @Post("sessions/:id/events")
  async recordEvent(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: ExplorationEventDto,
  ) {
    return {
      data: await this.store.recordExplorationSessionEvent(
        request.user!.uid,
        id,
        dto,
      ),
    };
  }

  @Post("sessions/:id/end")
  async endSession(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return {
      data: await this.store.endExplorationSession(request.user!.uid, id),
    };
  }
}
