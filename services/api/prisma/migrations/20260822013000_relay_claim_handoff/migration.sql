ALTER TABLE "CooperativeActionChapter"
ADD COLUMN "alternativeTaskId" TEXT;

ALTER TABLE "CooperativeActionRun"
ADD COLUMN "claimedChapterId" TEXT,
ADD COLUMN "claimedById" TEXT,
ADD COLUMN "claimedTaskId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "claimExpiresAt" TIMESTAMP(3);

ALTER TABLE "CooperativeActionContribution"
ADD COLUMN "taskId" TEXT;

UPDATE "CooperativeActionContribution" AS contribution
SET "taskId" = chapter."taskId"
FROM "CooperativeActionChapter" AS chapter
WHERE contribution."chapterId" = chapter."id";

ALTER TABLE "CooperativeActionContribution"
ALTER COLUMN "taskId" SET NOT NULL;

CREATE UNIQUE INDEX "CooperativeActionChapter_alternativeTaskId_key"
ON "CooperativeActionChapter"("alternativeTaskId");

CREATE INDEX "CooperativeActionRun_claimedById_claimExpiresAt_idx"
ON "CooperativeActionRun"("claimedById", "claimExpiresAt");

ALTER TABLE "CooperativeActionChapter"
ADD CONSTRAINT "CooperativeActionChapter_alternativeTaskId_fkey"
FOREIGN KEY ("alternativeTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionRun"
ADD CONSTRAINT "CooperativeActionRun_claimedChapterId_fkey"
FOREIGN KEY ("claimedChapterId") REFERENCES "CooperativeActionChapter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionRun"
ADD CONSTRAINT "CooperativeActionRun_claimedById_fkey"
FOREIGN KEY ("claimedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionRun"
ADD CONSTRAINT "CooperativeActionRun_claimedTaskId_fkey"
FOREIGN KEY ("claimedTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionContribution"
ADD CONSTRAINT "CooperativeActionContribution_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
