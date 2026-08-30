CREATE TYPE "ExplorationStepSource" AS ENUM ('APPLE_HEALTH', 'HEALTH_CONNECT');

ALTER TABLE "ExplorationSession"
ADD COLUMN "lastStepTotal" INTEGER,
ADD COLUMN "stepSource" "ExplorationStepSource";

ALTER TABLE "LocationEventReceipt"
ADD COLUMN "stepTotal" INTEGER,
ADD COLUMN "stepSource" "ExplorationStepSource";

CREATE TABLE "ExplorationQuestWitness" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "questId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "witnessTier" "ActionWitnessTier" NOT NULL DEFAULT 'COMPOSITE',
  "dwellSeconds" INTEGER NOT NULL DEFAULT 0,
  "stepCount" INTEGER NOT NULL DEFAULT 0,
  "distanceMeters" INTEGER NOT NULL DEFAULT 0,
  "firstInsideAt" TIMESTAMP(3) NOT NULL,
  "lastInsideAt" TIMESTAMP(3) NOT NULL,
  "stepSource" "ExplorationStepSource",
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExplorationQuestWitness_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExplorationQuestWitness_progress_check" CHECK (
    "dwellSeconds" >= 0 AND "stepCount" >= 0 AND "distanceMeters" >= 0
  ),
  CONSTRAINT "ExplorationQuestWitness_tier_check" CHECK ("witnessTier" = 'COMPOSITE')
);

CREATE UNIQUE INDEX "ExplorationQuestWitness_sessionId_questId_key"
ON "ExplorationQuestWitness"("sessionId", "questId");

CREATE INDEX "ExplorationQuestWitness_questId_userId_householdId_completedAt_idx"
ON "ExplorationQuestWitness"("questId", "userId", "householdId", "completedAt");

CREATE INDEX "ExplorationQuestWitness_userId_householdId_createdAt_idx"
ON "ExplorationQuestWitness"("userId", "householdId", "createdAt");

ALTER TABLE "ExplorationQuestWitness"
ADD CONSTRAINT "ExplorationQuestWitness_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ExplorationSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationQuestWitness"
ADD CONSTRAINT "ExplorationQuestWitness_questId_fkey"
FOREIGN KEY ("questId") REFERENCES "MapQuest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationQuestWitness"
ADD CONSTRAINT "ExplorationQuestWitness_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationQuestWitness"
ADD CONSTRAINT "ExplorationQuestWitness_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationSession"
ADD CONSTRAINT "ExplorationSession_lastStepTotal_check"
CHECK ("lastStepTotal" IS NULL OR "lastStepTotal" >= 0);

ALTER TABLE "LocationEventReceipt"
ADD CONSTRAINT "LocationEventReceipt_stepTotal_check"
CHECK ("stepTotal" IS NULL OR "stepTotal" >= 0);
