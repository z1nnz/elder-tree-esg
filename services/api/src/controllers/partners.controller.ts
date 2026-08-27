import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PartnerCampaignDto } from "../dto/api.dto";
import type { AuthenticatedRequest } from "../security/api-auth.guard";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("journey-partners")
@ApiBearerAuth()
@Controller("partners")
export class PartnersController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("organizations")
  async organizations(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.store.listPartnerOrganizations(request.user!.uid),
    };
  }

  @Get("organizations/:organizationId/workspace")
  async workspace(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
  ) {
    return {
      data: await this.store.getPartnerWorkspace(
        request.user!.uid,
        organizationId,
      ),
    };
  }

  @Post("organizations/:organizationId/campaigns")
  async createCampaign(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Body() dto: PartnerCampaignDto,
  ) {
    return {
      data: await this.store.createPartnerCampaign(
        request.user!.uid,
        organizationId,
        dto,
      ),
    };
  }

  @Patch("organizations/:organizationId/campaigns/:campaignId")
  async updateCampaign(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: PartnerCampaignDto,
  ) {
    return {
      data: await this.store.updatePartnerCampaign(
        request.user!.uid,
        organizationId,
        campaignId,
        dto,
      ),
    };
  }

  @Post("organizations/:organizationId/campaigns/:campaignId/submit")
  async submitCampaign(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
  ) {
    return {
      data: await this.store.submitPartnerCampaign(
        request.user!.uid,
        organizationId,
        campaignId,
      ),
    };
  }
}
