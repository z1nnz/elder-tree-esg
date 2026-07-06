CREATE TYPE "EvidenceStatus" AS ENUM (
  'PENDING_UPLOAD',
  'PROCESSING',
  'AWAITING_REVIEW',
  'RESOLVED',
  'ERROR'
);

ALTER TABLE "Evidence"
ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
ADD COLUMN "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
ADD COLUMN "errorCode" TEXT;

ALTER TABLE "Evidence"
ALTER COLUMN "contentType" DROP DEFAULT;

ALTER TABLE "Evidence"
DROP CONSTRAINT "Evidence_assignmentId_fkey";

ALTER TABLE "Evidence"
ADD CONSTRAINT "Evidence_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationRun"
ADD CONSTRAINT "VerificationRun_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
