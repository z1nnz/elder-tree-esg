ALTER TABLE "FamilyMessage"
DROP CONSTRAINT "FamilyMessage_authorId_fkey";

ALTER TABLE "FamilyMessage"
ADD CONSTRAINT "FamilyMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
