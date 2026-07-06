ALTER TABLE "VerificationRun"
DROP CONSTRAINT "VerificationRun_evidenceId_fkey";

ALTER TABLE "VerificationRun"
ADD CONSTRAINT "VerificationRun_evidenceId_fkey"
FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
