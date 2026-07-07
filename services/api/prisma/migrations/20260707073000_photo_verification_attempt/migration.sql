-- Store photo verification summaries without storing originals.
CREATE TABLE "PhotoVerificationAttempt" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "decision" "VerificationDecision" NOT NULL,
  "labels" JSONB NOT NULL,
  "matchedLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confidence" DOUBLE PRECISION NOT NULL,
  "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PhotoVerificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoVerificationAttempt_assignmentId_idempotencyKey_key"
  ON "PhotoVerificationAttempt"("assignmentId", "idempotencyKey");

CREATE INDEX "PhotoVerificationAttempt_assignmentId_createdAt_idx"
  ON "PhotoVerificationAttempt"("assignmentId", "createdAt");

ALTER TABLE "PhotoVerificationAttempt"
  ADD CONSTRAINT "PhotoVerificationAttempt_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
