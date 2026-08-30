import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";

const EXPLORATION_SESSION_RETENTION_MS = 4 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

@Injectable()
export class ExplorationPrivacyCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExplorationPrivacyCleanupService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    void this.runCleanup();
    this.cleanupTimer = setInterval(
      () => void this.runCleanup(),
      CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  async expireStaleSessions() {
    const cutoff = new Date(
      this.clock.now().getTime() - EXPLORATION_SESSION_RETENTION_MS,
    );
    return this.prisma.explorationSession.updateMany({
      where: {
        status: "ACTIVE",
        startedAt: { lt: cutoff },
      },
      data: {
        status: "EXPIRED",
        endedAt: this.clock.now(),
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
      },
    });
  }

  private async runCleanup(): Promise<void> {
    try {
      await this.expireStaleSessions();
    } catch (error) {
      this.logger.error(
        "Failed to clear precise coordinates from expired exploration sessions",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
