import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateMessageDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("family")
@ApiBearerAuth()
@Controller()
export class FamilyController {
  constructor(
    private readonly persistentStore: PersistentStoreService,
    private readonly demoStore: DemoStoreService,
  ) {}

  @Get("tree")
  async getTree(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.getTree() };
    }
    return { data: await this.persistentStore.getTree(request.user!.uid) };
  }

  @Get("family/messages")
  listMessages() {
    return { data: this.demoStore.listMessages() };
  }

  @Post("family/messages")
  createMessage(@Body() dto: CreateMessageDto) {
    return { data: this.demoStore.createMessage(dto.body) };
  }
}
