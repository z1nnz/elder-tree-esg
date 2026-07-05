import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CompleteEvidenceDto,
  CompleteTaskDto,
  InitializeEvidenceDto,
} from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("tasks")
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(
    private readonly persistentStore: PersistentStoreService,
    private readonly demoStore: DemoStoreService,
  ) {}

  @Get("tasks")
  async listTasks(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.listTasks() };
    }
    return { data: await this.persistentStore.listTasks(request.user!.uid) };
  }

  @Post("tasks/:id/start")
  async startTask(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.startTask(id) };
    }
    return { data: await this.persistentStore.startTask(request.user!.uid, id) };
  }

  @Post("tasks/:id/complete")
  async completeTask(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.completeTask(id, dto.idempotencyKey) };
    }
    return {
      data: await this.persistentStore.completeTask(
        request.user!.uid,
        id,
        dto.idempotencyKey,
      ),
    };
  }

  @Post("evidence")
  initializeEvidence(@Body() dto: InitializeEvidenceDto) {
    return {
      data: this.demoStore.initializeEvidence(dto.assignmentId, dto.fileName),
    };
  }

  @Post("evidence/:id/complete")
  completeEvidence(@Param("id") id: string, @Body() dto: CompleteEvidenceDto) {
    return { data: this.demoStore.completeEvidence(id, dto.sha256) };
  }
}
