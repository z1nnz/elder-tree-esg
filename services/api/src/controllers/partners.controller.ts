import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PartnerCampaignDto, RedeemVenueOfferDto } from "../dto/api.dto";
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

  @Post("organizations/:organizationId/campaigns/:campaignId/venue-code")
  @Header("Cache-Control", "no-store")
  async venueCode(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
  ) {
    return {
      data: await this.store.createVenueChallenge(
        request.user!.uid,
        organizationId,
        campaignId,
      ),
    };
  }

  @Get("organizations/:organizationId/campaigns/:campaignId/venue-metrics")
  async venueMetrics(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
  ) {
    return {
      data: await this.store.getVenueMetrics(
        request.user!.uid,
        organizationId,
        campaignId,
      ),
    };
  }

  @Post("organizations/:organizationId/campaigns/:campaignId/redeem")
  async redeem(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: RedeemVenueOfferDto,
  ) {
    return {
      data: await this.store.redeemVenueOffer(
        request.user!.uid,
        organizationId,
        campaignId,
        dto.code,
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
