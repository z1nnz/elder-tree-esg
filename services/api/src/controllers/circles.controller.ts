import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ClaimCooperativeActionChapterDto,
  CompleteCooperativeActionChapterDto,
  HandoffCooperativeActionChapterDto,
  CreateCircleDto,
  UpdateCircleProfileDto,
  JourneyHistoryQueryDto,
  StartJourneyDto,
} from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { DemoStoreService } from "../store/demo-store.service";
import { PersistentStoreService } from "../store/persistent-store.service";
import { CircleSettingsService } from "../store/circle-settings.service";
import { JourneyLibraryService } from "../store/journey-library.service";

@ApiTags("circles")
@ApiBearerAuth()
@Controller("circles")
export class CirclesController {
  constructor(
    private readonly persistentStore: PersistentStoreService,
    private readonly demoStore: DemoStoreService,
    private readonly settings: CircleSettingsService,
    private readonly journeys: JourneyLibraryService,
  ) {}

  @Get("current/journeys")
  async library(
    @Req() request: AuthenticatedRequest,
    @Query() query: JourneyHistoryQueryDto,
  ) {
    if (process.env.DEMO_MODE !== "false")
      throw new ConflictException("Journey history requires persistent mode");
    return { data: await this.journeys.shelf(request.user!.uid, query.before) };
  }

  @Post("current/journeys")
  async startJourney(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartJourneyDto,
  ) {
    if (process.env.DEMO_MODE !== "false")
      throw new ConflictException("Journey history requires persistent mode");
    return { data: await this.journeys.start(request.user!.uid, dto) };
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCircleDto,
  ) {
    return { data: await this.settings.create(request.user!.uid, dto) };
  }

  @Patch(":circleId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("circleId") circleId: string,
    @Body() dto: UpdateCircleProfileDto,
  ) {
    return {
      data: await this.settings.update(request.user!.uid, circleId, dto),
    };
  }

  @Get("current")
  async current(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.getCircleOverview() };
    }
    return {
      data: await this.persistentStore.getCircleOverview(request.user!.uid),
    };
  }

  @Post("current/actions/:runId/chapters/:chapterId/complete")
  async completeChapter(
    @Req() request: AuthenticatedRequest,
    @Param("runId") runId: string,
    @Param("chapterId") chapterId: string,
    @Body() dto: CompleteCooperativeActionChapterDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: this.demoStore.completeCooperativeActionChapter(
          runId,
          chapterId,
          request.user!.uid,
          dto.idempotencyKey,
        ),
      };
    }
    return {
      data: await this.persistentStore.completeCooperativeActionChapter(
        request.user!.uid,
        runId,
        chapterId,
        dto.idempotencyKey,
      ),
    };
  }

  @Post("current/actions/:runId/chapters/:chapterId/claim")
  async claimChapter(
    @Req() request: AuthenticatedRequest,
    @Param("runId") runId: string,
    @Param("chapterId") chapterId: string,
    @Body() dto: ClaimCooperativeActionChapterDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: this.demoStore.claimCooperativeActionChapter(
          runId,
          chapterId,
          request.user!.uid,
          dto.useAlternative ?? false,
        ),
      };
    }
    return {
      data: await this.persistentStore.claimCooperativeActionChapter(
        request.user!.uid,
        runId,
        chapterId,
        dto.useAlternative ?? false,
      ),
    };
  }

  @Post("current/actions/:runId/chapters/:chapterId/handoff")
  async handoffChapter(
    @Req() request: AuthenticatedRequest,
    @Param("runId") runId: string,
    @Param("chapterId") chapterId: string,
    @Body() dto: HandoffCooperativeActionChapterDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: this.demoStore.handoffCooperativeActionChapter(
          runId,
          chapterId,
          request.user!.uid,
          dto.memberId,
        ),
      };
    }
    return {
      data: await this.persistentStore.handoffCooperativeActionChapter(
        request.user!.uid,
        runId,
        chapterId,
        dto.memberId,
      ),
    };
  }

  @Post("current/actions/:runId/chapters/:chapterId/release-expired")
  async releaseExpiredClaim(
    @Req() request: AuthenticatedRequest,
    @Param("runId") runId: string,
    @Param("chapterId") chapterId: string,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: this.demoStore.releaseExpiredCooperativeActionClaim(
          runId,
          chapterId,
          request.user!.uid,
        ),
      };
    }
    return {
      data: await this.persistentStore.releaseExpiredCooperativeActionClaim(
        request.user!.uid,
        runId,
        chapterId,
      ),
    };
  }
}
