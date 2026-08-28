ALTER TABLE "CooperativeActionRun" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CooperativeActionRun" ADD COLUMN "previousRunId" TEXT;
ALTER TABLE "CooperativeActionRun" ADD COLUMN "resultSnapshot" JSONB;

-- Retain every legacy run and contribution. Prefer a started active run, then
-- the latest record; selection never clears or completes an existing run.
UPDATE "CooperativeActionRun" SET "isCurrent" = true WHERE "id" IN (
  SELECT DISTINCT ON ("householdId") "id" FROM "CooperativeActionRun"
  ORDER BY "householdId", ("status" = 'ACTIVE' AND ("claimedById" IS NOT NULL OR EXISTS (
    SELECT 1 FROM "CooperativeActionContribution" c WHERE c."runId" = "CooperativeActionRun"."id"
  ))) DESC, ("status" = 'ACTIVE') DESC, "startedAt" DESC, "id" DESC
);
ALTER TABLE "CooperativeActionRun" ALTER COLUMN "isCurrent" SET DEFAULT true;
DROP INDEX "CooperativeActionRun_actionId_householdId_key";
CREATE INDEX "CooperativeActionRun_actionId_householdId_startedAt_idx" ON "CooperativeActionRun"("actionId", "householdId", "startedAt");
CREATE UNIQUE INDEX "CooperativeActionRun_current_circle_key" ON "CooperativeActionRun"("householdId") WHERE "isCurrent" = true;
CREATE UNIQUE INDEX "CooperativeActionRun_previousRunId_key" ON "CooperativeActionRun"("previousRunId");
ALTER TABLE "CooperativeActionRun" ADD CONSTRAINT "CooperativeActionRun_previousRunId_fkey" FOREIGN KEY ("previousRunId") REFERENCES "CooperativeActionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
