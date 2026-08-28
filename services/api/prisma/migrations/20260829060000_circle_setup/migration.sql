ALTER TABLE "Household" ADD COLUMN "settingsRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Household" ADD COLUMN "configuredAt" TIMESTAMP(3);
ALTER TABLE "HouseholdMember" ADD COLUMN "canManageCircle" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing names and avoid showing first-use setup to existing circles.
UPDATE "Household" SET "configuredAt" = "createdAt";

-- Legacy membership has no creator timestamp. Grant only the sole member;
-- never guess an owner in an existing multi-member circle.
UPDATE "HouseholdMember" AS member
SET "canManageCircle" = true
WHERE member."householdId" IN (
  SELECT "householdId" FROM "HouseholdMember"
  GROUP BY "householdId" HAVING COUNT(*) = 1
);

CREATE TABLE "CircleCreation" (
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CircleCreation_pkey" PRIMARY KEY ("userId", "idempotencyKey"),
  CONSTRAINT "CircleCreation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CircleCreation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
