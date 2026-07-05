import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateMessageDto } from "../dto/api.dto";
import { DemoStoreService } from "../store/demo-store.service";

@ApiTags("family")
@ApiBearerAuth()
@Controller()
export class FamilyController {
  constructor(private readonly store: DemoStoreService) {}

  @Get("tree")
  getTree() {
    return { data: this.store.getTree() };
  }

  @Get("family/messages")
  listMessages() {
    return { data: this.store.listMessages() };
  }

  @Post("family/messages")
  createMessage(@Body() dto: CreateMessageDto) {
    return { data: this.store.createMessage(dto.body) };
  }
}
