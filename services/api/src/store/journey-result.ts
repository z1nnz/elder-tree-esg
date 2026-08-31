import type { JourneyResult } from "@elder-tree/contracts";
import type { Prisma } from "@prisma/client";

export const LIFE_TREE_KEEPSAKE_SLOT_COUNT = 12;

async function resolveKeepsakeSlot(
  transaction: Prisma.TransactionClient,
  householdId: string,
  runId: string,
  isAlreadyCompleted: boolean,
): Promise<number> {
  if (!isAlreadyCompleted) {
    const completedCount = await transaction.cooperativeActionRun.count({
      where: {
        householdId,
        status: "COMPLETED",
        completedAt: { not: null },
      },
    });
    return completedCount % LIFE_TREE_KEEPSAKE_SLOT_COUNT;
  }
  const completedRuns = await transaction.cooperativeActionRun.findMany({
    where: {
      householdId,
      status: "COMPLETED",
      completedAt: { not: null },
    },
    select: { id: true },
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
  });
  const ordinal = completedRuns.findIndex((item) => item.id === runId);
  if (ordinal < 0) throw new Error("Completed journey is missing from history");
  return ordinal % LIFE_TREE_KEEPSAKE_SLOT_COUNT;
}

// Snapshot names, chosen actions, witness tiers and the actual growth receipt.
// Later template/profile edits must not rewrite the completed journey.
export async function buildJourneyResult(
  transaction: Prisma.TransactionClient,
  runId: string,
  completedAt: Date,
  historicalImport = false,
): Promise<JourneyResult> {
  const run = await transaction.cooperativeActionRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      action: true,
      contributions: {
        include: { user: true, task: true, chapter: true },
        orderBy: { chapter: { sequence: "asc" } },
      },
    },
  });
  const receipt = await transaction.growthEntry.findUnique({
    where: { idempotencyKey: `cooperative-action:${runId}` },
  });
  const keepsakeSlot = await resolveKeepsakeSlot(
    transaction,
    run.householdId,
    runId,
    run.status === "COMPLETED",
  );
  return {
    runId,
    actionId: run.actionId,
    title: run.action.title,
    keepsakeName: run.action.keepsakeName,
    keepsakeSlot,
    completedAt: completedAt.toISOString(),
    growthPoints: receipt?.points ?? 0,
    historicalImport,
    contributions: run.contributions.map((item) => ({
      memberId: item.userId,
      displayName: item.user.displayName,
      actionTitle: item.task.title,
      elementName: item.chapter.elementName,
      usedAlternative: item.taskId === item.chapter.alternativeTaskId,
      witnessedAt: item.witnessedAt.toISOString(),
      witnessTier: item.witnessTier,
      witnessStartedAt: item.witnessStartedAt?.toISOString() ?? null,
      witnessMinimumSeconds: item.witnessMinimumSeconds,
      witnessElapsedSeconds: item.witnessElapsedSeconds,
    })),
  };
}
