CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "QuestTriggerType" AS ENUM ('DISTANCE', 'GEOFENCE');

CREATE TABLE "MapQuest" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "triggerType" "QuestTriggerType" NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "radiusMeters" INTEGER,
  "unlockDistanceMeters" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MapQuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExplorationProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "totalDistanceMeters" INTEGER NOT NULL DEFAULT 0,
  "lastEventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExplorationProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationEventReceipt" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "coarseCell" TEXT NOT NULL,
  "distanceMeters" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocationEventReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestUnlock" (
  "id" TEXT NOT NULL,
  "questId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MapQuest_taskId_key" ON "MapQuest"("taskId");
CREATE UNIQUE INDEX "ExplorationProgress_userId_householdId_key"
ON "ExplorationProgress"("userId", "householdId");
CREATE UNIQUE INDEX "LocationEventReceipt_eventKey_key"
ON "LocationEventReceipt"("eventKey");
CREATE UNIQUE INDEX "QuestUnlock_questId_userId_householdId_key"
ON "QuestUnlock"("questId", "userId", "householdId");

CREATE INDEX "MapQuest_location_gist"
ON "MapQuest"
USING GIST (
  (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
)
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

ALTER TABLE "MapQuest"
ADD CONSTRAINT "MapQuest_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationProgress"
ADD CONSTRAINT "ExplorationProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplorationProgress"
ADD CONSTRAINT "ExplorationProgress_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationEventReceipt"
ADD CONSTRAINT "LocationEventReceipt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationEventReceipt"
ADD CONSTRAINT "LocationEventReceipt_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestUnlock"
ADD CONSTRAINT "QuestUnlock_questId_fkey"
FOREIGN KEY ("questId") REFERENCES "MapQuest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestUnlock"
ADD CONSTRAINT "QuestUnlock_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestUnlock"
ADD CONSTRAINT "QuestUnlock_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
