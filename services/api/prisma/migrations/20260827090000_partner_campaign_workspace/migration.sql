CREATE TYPE "PartnerCampaignStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVED');

ALTER TABLE "Campaign"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "venueName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "latitude" DOUBLE PRECISION NOT NULL DEFAULT 25.033,
ADD COLUMN "longitude" DOUBLE PRECISION NOT NULL DEFAULT 121.5654,
ADD COLUMN "radiusMeters" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "verificationMode" "VerificationMode" NOT NULL DEFAULT 'SELF_CHECK',
ADD COLUMN "minimumSeconds" INTEGER,
ADD COLUMN "growthPoints" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "badgeName" TEXT,
ADD COLUMN "accessibilityNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "safetyNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "optionalOffer" TEXT,
ADD COLUMN "purchaseRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" "PartnerCampaignStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RadarMission"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "venueName" TEXT,
ADD COLUMN "accessibilityNotes" TEXT,
ADD COLUMN "safetyNotes" TEXT,
ADD COLUMN "optionalOffer" TEXT;

CREATE TABLE "CampaignReach" (
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignReach_pkey" PRIMARY KEY ("campaignId", "userId")
);

CREATE UNIQUE INDEX "RadarMission_campaignId_key" ON "RadarMission"("campaignId");
CREATE INDEX "OrganizationMember_userId_role_idx" ON "OrganizationMember"("userId", "role");
CREATE INDEX "Campaign_organizationId_status_createdAt_idx" ON "Campaign"("organizationId", "status", "createdAt");
CREATE INDEX "Campaign_status_submittedAt_idx" ON "Campaign"("status", "submittedAt");
CREATE INDEX "CampaignReach_campaignId_firstSeenAt_idx" ON "CampaignReach"("campaignId", "firstSeenAt");

ALTER TABLE "OrganizationMember"
ADD CONSTRAINT "OrganizationMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_organizationId_fkey";

ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RadarMission"
ADD CONSTRAINT "RadarMission_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignReach"
ADD CONSTRAINT "CampaignReach_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignReach"
ADD CONSTRAINT "CampaignReach_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
