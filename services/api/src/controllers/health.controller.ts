import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("system")
@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      data: {
        status: "ok",
        mode: process.env.DEMO_MODE === "false" ? "cloud" : "demo",
        timestamp: new Date().toISOString(),
      },
    };
  }
}
