import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminController } from "./controllers/admin.controller";
import { DevicesController } from "./controllers/devices.controller";
import { FamilyController } from "./controllers/family.controller";
import { HealthController } from "./controllers/health.controller";
import { ImpactController } from "./controllers/impact.controller";
import { TasksController } from "./controllers/tasks.controller";
import { ApiAuthGuard } from "./security/api-auth.guard";
import { DemoStoreService } from "./store/demo-store.service";

@Module({
  controllers: [
    HealthController,
    TasksController,
    FamilyController,
    DevicesController,
    AdminController,
    ImpactController,
  ],
  providers: [
    DemoStoreService,
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AppModule {}
