import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateImpactBatchDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("impact")
@ApiBearerAuth()
@Controller("impact-batches")
export class ImpactController {
  constructor(
    private readonly store: DemoStoreService,
    private readonly persistentStore: PersistentStoreService,
  ) {}

  @Get("summary/current")
  async summary(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      const tree = this.store.getTree();
      return {
        data: {
          householdName: tree.householdName,
          treeStage: tree.stage,
          growthPoints: tree.growthPoints,
          nextStageAt: tree.nextStageAt,
          contributedPoints: 0,
        },
      };
    }
    return {
      data: await this.persistentStore.getImpactSummary(request.user!.uid),
    };
  }

  @Get()
  list() {
    return { data: this.store.listBatches() };
  }

  @Post()
  create(@Body() dto: CreateImpactBatchDto) {
    return {
      data: this.store.createBatch(dto.title, dto.allocatedPoints, dto.simulated),
    };
  }

  @Post(":id/publish")
  publish(@Param("id") id: string) {
    return { data: this.store.publishBatch(id) };
  }
}
