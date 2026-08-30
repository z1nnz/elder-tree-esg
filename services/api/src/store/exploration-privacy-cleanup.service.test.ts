import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service";
import type { ClockService } from "../time/clock.service";
import { ExplorationPrivacyCleanupService } from "./exploration-privacy-cleanup.service";

describe("ExplorationPrivacyCleanupService", () => {
  it("expires stale sessions and clears only their latest precise location", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const now = new Date("2026-08-30T12:00:00.000Z");
    const service = new ExplorationPrivacyCleanupService(
      {
        explorationSession: { updateMany },
      } as unknown as PrismaService,
      { now: () => now } as ClockService,
    );

    await expect(service.expireStaleSessions()).resolves.toEqual({ count: 2 });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
        startedAt: { lt: new Date("2026-08-30T08:00:00.000Z") },
      },
      data: {
        status: "EXPIRED",
        endedAt: now,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastStepTotal: null,
        stepSource: null,
      },
    });
  });
});
