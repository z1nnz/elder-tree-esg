import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ExplorationEventDto } from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("exploration")
@ApiBearerAuth()
@Controller("exploration")
export class ExplorationController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("state")
  async state(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: {
          totalDistanceMeters: 0,
          coarseCell: null,
          quests: [],
        },
      };
    }
    return {
      data: await this.store.getExplorationState(request.user!.uid),
    };
  }

  @Post("events")
  async recordEvent(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ExplorationEventDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return {
        data: {
          totalDistanceMeters: dto.distanceMeters,
          coarseCell: null,
          quests: [],
          duplicate: false,
          newlyUnlockedTaskIds: [],
        },
      };
    }
    return {
      data: await this.store.recordExplorationEvent(request.user!.uid, dto),
    };
  }
}
