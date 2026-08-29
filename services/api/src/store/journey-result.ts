import type { JourneyResult } from "@elder-tree/contracts";
import type { Prisma } from "@prisma/client";

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
  return {
    runId,
    actionId: run.actionId,
    title: run.action.title,
    keepsakeName: run.action.keepsakeName,
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
