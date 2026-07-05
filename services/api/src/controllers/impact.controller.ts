import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateImpactBatchDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";

@ApiTags("impact")
@ApiBearerAuth()
@Controller("impact-batches")
export class ImpactController {
  constructor(private readonly store: DemoStoreService) {}

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
