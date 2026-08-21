CREATE TYPE "CircleKind" AS ENUM (
  'FAMILY',
  'FRIENDS',
  'COMMUNITY',
  'COMPANY',
  'SCHOOL',
  'CARE_SITE',
  'VOLUNTEER',
  'INTEREST'
);

CREATE TYPE "CooperativeActionKind" AS ENUM ('COLLECTION', 'RELAY');
CREATE TYPE "CooperativeActionPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CooperativeActionRunStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');
CREATE TYPE "ActionWitnessTier" AS ENUM ('SELF_CHECK', 'PROCESS', 'COMPOSITE', 'PARTNER');

ALTER TABLE "Household"
ADD COLUMN "circleKind" "CircleKind" NOT NULL DEFAULT 'FAMILY';

CREATE TABLE "CooperativeAction" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "kind" "CooperativeActionKind" NOT NULL DEFAULT 'COLLECTION',
  "status" "CooperativeActionPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "minimumContributors" INTEGER NOT NULL DEFAULT 2,
  "maxChaptersPerMember" INTEGER NOT NULL DEFAULT 1,
  "growthPoints" INTEGER NOT NULL,
  "keepsakeName" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CooperativeAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CooperativeActionChapter" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "elementName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CooperativeActionChapter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CooperativeActionRun" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "status" "CooperativeActionRunStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CooperativeActionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CooperativeActionContribution" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "witnessTier" "ActionWitnessTier" NOT NULL DEFAULT 'SELF_CHECK',
  "witnessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CooperativeActionContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CooperativeAction_slug_key" ON "CooperativeAction"("slug");
CREATE INDEX "CooperativeAction_status_startsAt_endsAt_idx" ON "CooperativeAction"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "CooperativeActionChapter_taskId_key" ON "CooperativeActionChapter"("taskId");
CREATE UNIQUE INDEX "CooperativeActionChapter_actionId_sequence_key" ON "CooperativeActionChapter"("actionId", "sequence");
CREATE INDEX "CooperativeActionChapter_actionId_idx" ON "CooperativeActionChapter"("actionId");
CREATE UNIQUE INDEX "CooperativeActionRun_actionId_householdId_key" ON "CooperativeActionRun"("actionId", "householdId");
CREATE INDEX "CooperativeActionRun_householdId_status_idx" ON "CooperativeActionRun"("householdId", "status");
CREATE UNIQUE INDEX "CooperativeActionContribution_idempotencyKey_key" ON "CooperativeActionContribution"("idempotencyKey");
CREATE UNIQUE INDEX "CooperativeActionContribution_runId_chapterId_key" ON "CooperativeActionContribution"("runId", "chapterId");
CREATE INDEX "CooperativeActionContribution_runId_userId_idx" ON "CooperativeActionContribution"("runId", "userId");

ALTER TABLE "CooperativeActionChapter"
ADD CONSTRAINT "CooperativeActionChapter_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "CooperativeAction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionChapter"
ADD CONSTRAINT "CooperativeActionChapter_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionRun"
ADD CONSTRAINT "CooperativeActionRun_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "CooperativeAction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionRun"
ADD CONSTRAINT "CooperativeActionRun_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionContribution"
ADD CONSTRAINT "CooperativeActionContribution_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "CooperativeActionRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionContribution"
ADD CONSTRAINT "CooperativeActionContribution_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "CooperativeActionChapter"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CooperativeActionContribution"
ADD CONSTRAINT "CooperativeActionContribution_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
