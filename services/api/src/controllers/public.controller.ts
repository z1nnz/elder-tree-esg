import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../security/public.decorator";
import { PersistentStoreService } from "../store/persistent-store.service";

@ApiTags("public")
@Public()
@Controller("public")
export class PublicController {
  constructor(private readonly store: PersistentStoreService) {}

  @Get("exploration/routes/:slug")
  async route(@Param("slug") slug: string) {
    return { data: await this.store.getPublicExplorationRoute(slug) };
  }
}
