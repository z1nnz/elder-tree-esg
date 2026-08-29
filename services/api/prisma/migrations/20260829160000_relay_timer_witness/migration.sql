ALTER TABLE "CooperativeActionContribution"
ADD COLUMN "witnessStartedAt" TIMESTAMP(3),
ADD COLUMN "witnessMinimumSeconds" INTEGER,
ADD COLUMN "witnessElapsedSeconds" INTEGER;

ALTER TABLE "CooperativeActionContribution"
ADD CONSTRAINT "CooperativeActionContribution_witnessMinimumSeconds_check"
CHECK ("witnessMinimumSeconds" IS NULL OR "witnessMinimumSeconds" > 0),
ADD CONSTRAINT "CooperativeActionContribution_witnessElapsedSeconds_check"
CHECK ("witnessElapsedSeconds" IS NULL OR "witnessElapsedSeconds" >= 0),
ADD CONSTRAINT "CooperativeActionContribution_witnessElapsedMeetsMinimum_check"
CHECK (
  "witnessElapsedSeconds" IS NULL
  OR "witnessMinimumSeconds" IS NULL
  OR "witnessElapsedSeconds" >= "witnessMinimumSeconds"
);
