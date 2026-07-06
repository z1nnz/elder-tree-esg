import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateMessageDto, ReviewDecisionDto } from "../dto/api.dto";
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
  async listMessages(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.listMessages() };
    }
    return {
      data: await this.persistentStore.listMessages(request.user!.uid),
    };
  }

  @Post("family/messages")
  async createMessage(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMessageDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.createMessage(dto.body) };
    }
    return {
      data: await this.persistentStore.createMessage(
        request.user!.uid,
        dto.body,
      ),
    };
  }

  @Get("family/reviews")
  async listReviews(@Req() request: AuthenticatedRequest) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: [] };
    }
    return {
      data: await this.persistentStore.listFamilyReviews(request.user!.uid),
    };
  }

  @Post("family/reviews/:id/decision")
  async decideReview(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    if (process.env.DEMO_MODE !== "false") {
      return { data: this.demoStore.decideReview(id, dto.decision, dto.note) };
    }
    return {
      data: await this.persistentStore.decideFamilyReview(
        request.user!.uid,
        id,
        dto.decision,
      ),
    };
  }
}
