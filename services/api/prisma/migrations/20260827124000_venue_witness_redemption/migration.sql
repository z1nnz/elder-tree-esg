ALTER TABLE "Campaign" ADD COLUMN "requiresVenueWitness" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RadarMission" ADD COLUMN "requiresVenueWitness" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VenueChallenge" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VenueWitnessReceipt" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "witnessedAt" TIMESTAMP(3) NOT NULL,
    "redemptionTokenHash" TEXT,
    "redemptionExpiresAt" TIMESTAMP(3),
    "redemptionIssuedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    CONSTRAINT "VenueWitnessReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueChallenge_tokenHash_key" ON "VenueChallenge"("tokenHash");
CREATE INDEX "VenueChallenge_campaignId_createdAt_idx" ON "VenueChallenge"("campaignId", "createdAt");
CREATE INDEX "VenueChallenge_expiresAt_idx" ON "VenueChallenge"("expiresAt");
CREATE UNIQUE INDEX "VenueWitnessReceipt_redemptionTokenHash_key" ON "VenueWitnessReceipt"("redemptionTokenHash");
CREATE UNIQUE INDEX "VenueWitnessReceipt_campaignId_userId_key" ON "VenueWitnessReceipt"("campaignId", "userId");
CREATE INDEX "VenueWitnessReceipt_campaignId_redeemedAt_idx" ON "VenueWitnessReceipt"("campaignId", "redeemedAt");

ALTER TABLE "VenueChallenge" ADD CONSTRAINT "VenueChallenge_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueWitnessReceipt" ADD CONSTRAINT "VenueWitnessReceipt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueWitnessReceipt" ADD CONSTRAINT "VenueWitnessReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueWitnessReceipt" ADD CONSTRAINT "VenueWitnessReceipt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
