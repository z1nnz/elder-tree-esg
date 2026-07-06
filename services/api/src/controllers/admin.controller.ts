import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateExplorationQuestDto,
  CreateExplorationRouteDto,
  ReorderExplorationQuestsDto,
  UpdateExplorationQuestDto,
  UpdateExplorationRouteDto,
} from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PlatformAdminGuard } from "../security/platform-admin.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("dashboard")
  async dashboard() {
    return { data: await this.store.getAdminDashboard() };
  }

  @Get("reviews")
  async reviews() {
    return { data: await this.store.listAdminReviews() };
  }

  @Get("exploration/routes")
  async routes() {
    return { data: await this.store.listAdminExplorationRoutes() };
  }

  @Post("exploration/routes")
  async createRoute(@Body() dto: CreateExplorationRouteDto) {
    return { data: await this.store.createAdminExplorationRoute(dto) };
  }

  @Patch("exploration/routes/:id")
  async updateRoute(
    @Param("id") id: string,
    @Body() dto: UpdateExplorationRouteDto,
  ) {
    return { data: await this.store.updateAdminExplorationRoute(id, dto) };
  }

  @Post("exploration/routes/:id/publish")
  async publishRoute(@Param("id") id: string) {
    return { data: await this.store.publishAdminExplorationRoute(id) };
  }

  @Post("exploration/routes/:id/duplicate")
  async duplicateRoute(@Param("id") id: string) {
    return { data: await this.store.duplicateAdminExplorationRoute(id) };
  }

  @Post("exploration/routes/:id/archive")
  async archiveRoute(@Param("id") id: string) {
    return { data: await this.store.archiveAdminExplorationRoute(id) };
  }

  @Post("exploration/quests")
  async createQuest(@Body() dto: CreateExplorationQuestDto) {
    return { data: await this.store.createAdminExplorationQuest(dto) };
  }

  @Patch("exploration/quests/:id")
  async updateQuest(
    @Param("id") id: string,
    @Body() dto: UpdateExplorationQuestDto,
  ) {
    return { data: await this.store.updateAdminExplorationQuest(id, dto) };
  }

  @Post("exploration/routes/:id/reorder")
  async reorderQuests(
    @Param("id") id: string,
    @Body() dto: ReorderExplorationQuestsDto,
  ) {
    return {
      data: await this.store.reorderAdminExplorationQuests(id, dto.questIds),
    };
  }

  @Post("exploration/simulations/:routeId/steps/:step")
  async simulate(
    @Req() request: AuthenticatedRequest,
    @Param("routeId") routeId: string,
    @Param("step", ParseIntPipe) step: number,
  ) {
    return {
      data: await this.store.simulateExplorationStep(
        request.user!.uid,
        routeId,
        step,
      ),
    };
  }
}
