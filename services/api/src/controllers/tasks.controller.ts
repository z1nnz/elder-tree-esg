import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CompleteEvidenceDto,
  CompleteTaskDto,
  InitializeEvidenceDto,
} from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";

@ApiTags("tasks")
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly store: DemoStoreService) {}

  @Get("tasks")
  listTasks() {
    return { data: this.store.listTasks() };
  }

  @Post("tasks/:id/start")
  startTask(@Param("id") id: string) {
    return { data: this.store.startTask(id) };
  }

  @Post("tasks/:id/complete")
  completeTask(@Param("id") id: string, @Body() dto: CompleteTaskDto) {
    return { data: this.store.completeTask(id, dto.idempotencyKey) };
  }

  @Post("evidence")
  initializeEvidence(@Body() dto: InitializeEvidenceDto) {
    return {
      data: this.store.initializeEvidence(dto.assignmentId, dto.fileName),
    };
  }

  @Post("evidence/:id/complete")
  completeEvidence(@Param("id") id: string, @Body() dto: CompleteEvidenceDto) {
    return { data: this.store.completeEvidence(id, dto.sha256) };
  }
}
