import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";

const EXPLORATION_SESSION_RETENTION_MS = 4 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const privacyClearData = (status: "ENDED" | "EXPIRED", endedAt: Date) => ({
  status,
  endedAt,
  lastLatitude: null,
  lastLongitude: null,
  lastAccuracy: null,
  lastStepTotal: null,
  stepSource: null,
});

export async function closeExplorationSessionWithPrivacyClear(
  prisma: PrismaService,
  sessionId: string,
  endedAt: Date,
  options: {
    status: "ENDED" | "EXPIRED";
    startedBefore?: Date;
  },
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`exploration-session:${sessionId}`}))
    `;
    return transaction.explorationSession.updateMany({
      where: {
        id: sessionId,
        status: "ACTIVE",
        ...(options.startedBefore
          ? { startedAt: { lt: options.startedBefore } }
          : {}),
      },
      data: privacyClearData(options.status, endedAt),
    });
  });
}

export async function expireStaleExplorationSessions(
  prisma: PrismaService,
  now: Date,
  scope?: Prisma.ExplorationSessionWhereInput,
) {
  const cutoff = new Date(now.getTime() - EXPLORATION_SESSION_RETENTION_MS);
  const sessions = await prisma.explorationSession.findMany({
    where: {
      AND: [
        scope ?? {},
        { status: "ACTIVE", startedAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
  });
  let count = 0;
  for (const session of sessions) {
    const result = await closeExplorationSessionWithPrivacyClear(
      prisma,
      session.id,
      now,
      { status: "EXPIRED", startedBefore: cutoff },
    );
    count += result.count;
  }
  return { count };
}

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
    return expireStaleExplorationSessions(
      this.prisma,
      this.clock.now(),
    );
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
