import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminController } from "./controllers/admin.controller";
import { DevicesController } from "./controllers/devices.controller";
import { ExplorationController } from "./controllers/exploration.controller";
import { FamilyController } from "./controllers/family.controller";
import { HealthController } from "./controllers/health.controller";
import { ImpactController } from "./controllers/impact.controller";
import { MeController } from "./controllers/me.controller";
import { TasksController } from "./controllers/tasks.controller";
import { PublicController } from "./controllers/public.controller";
import { ApiAuthGuard } from "./security/api-auth.guard";
import { DemoStoreService } from "./store/demo-store.service";
import { PrismaService } from "./database/prisma.service";
import { PersistentStoreService } from "./store/persistent-store.service";
import { ClockService } from "./time/clock.service";
import { EvidenceStorageService } from "./evidence/evidence-storage.service";
import { PhotoVerifierService } from "./evidence/photo-verifier.service";
import { PlatformAdminGuard } from "./security/platform-admin.guard";

@Module({
  controllers: [
    HealthController,
    TasksController,
    MeController,
    FamilyController,
    ExplorationController,
    DevicesController,
    AdminController,
    ImpactController,
    PublicController,
  ],
  providers: [
    DemoStoreService,
    PrismaService,
    ClockService,
    EvidenceStorageService,
    PhotoVerifierService,
    PlatformAdminGuard,
    PersistentStoreService,
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AppModule {}
