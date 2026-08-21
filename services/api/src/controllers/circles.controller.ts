import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ClaimCooperativeActionChapterDto,
  CompleteCooperativeActionChapterDto,
  HandoffCooperativeActionChapterDto,
} from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { DemoStoreService } from "../store/demo-store.service";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("circles")
@ApiBearerAuth()
@Controller("circles")
export class CirclesController {
  constructor(
    private readonly persistentStore: PersistentStoreService,
    private readonly demoStore: DemoStoreService,
  ) {}

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
