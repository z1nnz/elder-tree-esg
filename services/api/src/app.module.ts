import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminController } from "./controllers/admin.controller";
import { CompanionPromptsController } from "./controllers/companion-prompts.controller";
import { CirclesController } from "./controllers/circles.controller";
import { DevicesController } from "./controllers/devices.controller";
import { DeviceSyncController } from "./controllers/device-sync.controller";
import { DeviceSyncService } from "./devices/device-sync.service";
import { DeviceBridgeGuard } from "./security/device-bridge.guard";
import { ExplorationController } from "./controllers/exploration.controller";
import { FamilyController } from "./controllers/family.controller";
import { HealthController } from "./controllers/health.controller";
import { ImpactController } from "./controllers/impact.controller";
import { LineController } from "./controllers/line.controller";
import { MeController } from "./controllers/me.controller";
import { TasksController } from "./controllers/tasks.controller";
import { PublicController } from "./controllers/public.controller";
import { PartnersController } from "./controllers/partners.controller";
import { ApiAuthGuard } from "./security/api-auth.guard";
import { DemoStoreService } from "./store/demo-store.service";
import { PrismaService } from "./database/prisma.service";
import { PersistentStoreService } from "./store/persistent-store.service";
import { ClockService } from "./time/clock.service";
import { EvidenceStorageService } from "./evidence/evidence-storage.service";
import { PhotoVerifierService } from "./evidence/photo-verifier.service";
import { PlatformAdminGuard } from "./security/platform-admin.guard";
import { LineMessagingService } from "./line/line-messaging.service";

@Module({
  controllers: [
    HealthController,
    TasksController,
    MeController,
    FamilyController,
    CirclesController,
    CompanionPromptsController,
    ExplorationController,
    DevicesController,
    DeviceSyncController,
    AdminController,
    LineController,
    ImpactController,
    PublicController,
    PartnersController,
  ],
  providers: [
    DemoStoreService,
    PrismaService,
    ClockService,
    EvidenceStorageService,
    PhotoVerifierService,
    LineMessagingService,
    PlatformAdminGuard,
    PersistentStoreService,
    DeviceSyncService,
    DeviceBridgeGuard,
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AppModule {}
