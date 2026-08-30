import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service";
import type { ClockService } from "../time/clock.service";
import { ExplorationPrivacyCleanupService } from "./exploration-privacy-cleanup.service";

describe("ExplorationPrivacyCleanupService", () => {
  it("expires stale sessions and clears only their latest precise location", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: "session-1" }, { id: "session-2" }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const executeRaw = vi.fn().mockResolvedValue(1);
    const transaction = vi.fn(async (callback: (client: unknown) => unknown) =>
      callback({
        $executeRaw: executeRaw,
        explorationSession: { updateMany },
      }),
    );
    const now = new Date("2026-08-30T12:00:00.000Z");
    const service = new ExplorationPrivacyCleanupService(
      {
        explorationSession: { findMany },
        $transaction: transaction,
      } as unknown as PrismaService,
      { now: () => now } as ClockService,
    );

    await expect(service.expireStaleSessions()).resolves.toEqual({ count: 2 });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {},
          {
            status: "ACTIVE",
            startedAt: { lt: new Date("2026-08-30T08:00:00.000Z") },
          },
        ],
      },
      select: { id: true },
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "session-1",
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
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "session-2",
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
