import { Controller, Get, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("companion-prompts")
@ApiBearerAuth()
@Controller("companion-prompts")
export class CompanionPromptsController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("recent")
  async recent(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.store.getRecentCompanionPrompts(request.user!.uid),
    };
  }
}
