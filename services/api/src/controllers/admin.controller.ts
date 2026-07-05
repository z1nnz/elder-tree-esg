import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReviewDecisionDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";

@ApiTags("administration")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(private readonly store: DemoStoreService) {}

  @Get("dashboard")
  dashboard() {
    return { data: this.store.getSnapshot() };
  }

  @Get("reviews")
  reviews() {
    return { data: this.store.listReviews() };
  }

  @Post("reviews/:id/decision")
  decide(
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return { data: this.store.decideReview(id, dto.decision, dto.note) };
  }

  @Get("audits")
  audits() {
    return { data: this.store.listAudits() };
  }
}
