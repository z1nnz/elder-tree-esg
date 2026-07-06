import { Body, Controller, Get, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  JoinHouseholdDto,
  SetActiveHouseholdDto,
  UpdateProfileDto,
} from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("account")
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("me/context")
  async context(@Req() request: AuthenticatedRequest) {
    return { data: await this.store.getContext(request.user!.uid) };
  }

  @Patch("me/profile")
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return {
      data: await this.store.updateDisplayName(
        request.user!.uid,
        dto.displayName,
      ),
    };
  }

  @Post("me/active-household")
  async setActiveHousehold(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetActiveHouseholdDto,
  ) {
    return {
      data: await this.store.setActiveHousehold(
        request.user!.uid,
        dto.householdId,
      ),
    };
  }

  @Post("households/invites")
  async createInvite(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.store.createHouseholdInvite(request.user!.uid),
    };
  }

  @Post("households/join")
  async joinHousehold(
    @Req() request: AuthenticatedRequest,
    @Body() dto: JoinHouseholdDto,
  ) {
    return {
      data: await this.store.joinHousehold(
        request.user!.uid,
        dto.code,
        dto.relationship,
      ),
    };
  }
}
