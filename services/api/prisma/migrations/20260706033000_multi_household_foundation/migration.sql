-- Add active-household context while preserving every existing membership.
ALTER TABLE "User" ADD COLUMN "activeHouseholdId" TEXT;
ALTER TABLE "TaskAssignment" ADD COLUMN "householdId" TEXT;
ALTER TABLE "TaskAssignment" ADD COLUMN "startedAt" TIMESTAMP(3);

UPDATE "User" AS "user"
SET "activeHouseholdId" = membership."householdId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "householdId"
  FROM "HouseholdMember"
  ORDER BY "userId", "householdId"
) AS membership
WHERE membership."userId" = "user"."id";

UPDATE "TaskAssignment" AS assignment
SET "householdId" = membership."householdId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "householdId"
  FROM "HouseholdMember"
  ORDER BY "userId", "householdId"
) AS membership
WHERE membership."userId" = assignment."userId";

ALTER TABLE "TaskAssignment" ALTER COLUMN "householdId" SET NOT NULL;

DROP INDEX "TaskAssignment_taskId_userId_key";
CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_householdId_key"
ON "TaskAssignment"("taskId", "userId", "householdId");

CREATE TABLE "HouseholdInvite" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseholdInvite_codeHash_key"
ON "HouseholdInvite"("codeHash");

ALTER TABLE "User"
ADD CONSTRAINT "User_activeHouseholdId_fkey"
FOREIGN KEY ("activeHouseholdId") REFERENCES "Household"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment"
ADD CONSTRAINT "TaskAssignment_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdInvite"
ADD CONSTRAINT "HouseholdInvite_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdInvite"
ADD CONSTRAINT "HouseholdInvite_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseholdInvite"
ADD CONSTRAINT "HouseholdInvite_usedById_fkey"
FOREIGN KEY ("usedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
