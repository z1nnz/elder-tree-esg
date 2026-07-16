CREATE TYPE "CompanionPromptSource" AS ENUM ('RADAR_MISSION');

ALTER TABLE "RadarMission"
ADD COLUMN "companionElderMessageTemplate" TEXT,
ADD COLUMN "companionReplyTemplate" TEXT,
ADD COLUMN "companionVolunteerNoteTemplate" TEXT,
ADD COLUMN "companionShareSummaryTemplate" TEXT;

CREATE TABLE "CompanionPrompt" (
  "id" TEXT NOT NULL,
  "sourceType" "CompanionPromptSource" NOT NULL DEFAULT 'RADAR_MISSION',
  "radarMissionProgressId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "growthPoints" INTEGER NOT NULL,
  "elderMessage" TEXT NOT NULL,
  "companionReply" TEXT NOT NULL,
  "volunteerNote" TEXT NOT NULL,
  "shareSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanionPrompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanionPrompt_radarMissionProgressId_key" ON "CompanionPrompt"("radarMissionProgressId");
CREATE INDEX "CompanionPrompt_userId_householdId_createdAt_idx" ON "CompanionPrompt"("userId", "householdId", "createdAt");
CREATE INDEX "CompanionPrompt_householdId_createdAt_idx" ON "CompanionPrompt"("householdId", "createdAt");

ALTER TABLE "CompanionPrompt"
ADD CONSTRAINT "CompanionPrompt_radarMissionProgressId_fkey"
FOREIGN KEY ("radarMissionProgressId") REFERENCES "RadarMissionProgress"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanionPrompt"
ADD CONSTRAINT "CompanionPrompt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanionPrompt"
ADD CONSTRAINT "CompanionPrompt_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
