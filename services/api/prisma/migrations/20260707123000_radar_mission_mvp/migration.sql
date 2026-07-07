CREATE TYPE "RadarMissionPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "RadarMission" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "verificationMode" "VerificationMode" NOT NULL,
  "minimumSeconds" INTEGER,
  "growthPoints" INTEGER NOT NULL,
  "badgeName" TEXT,
  "status" "RadarMissionPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RadarMission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadarMissionProgress" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastEventKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RadarMissionProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RadarMission_status_startsAt_endsAt_idx" ON "RadarMission"("status", "startsAt", "endsAt");
CREATE INDEX "RadarMission_latitude_longitude_idx" ON "RadarMission"("latitude", "longitude");
CREATE UNIQUE INDEX "RadarMissionProgress_missionId_userId_householdId_key" ON "RadarMissionProgress"("missionId", "userId", "householdId");
CREATE INDEX "RadarMissionProgress_userId_householdId_completedAt_idx" ON "RadarMissionProgress"("userId", "householdId", "completedAt");

ALTER TABLE "RadarMissionProgress"
ADD CONSTRAINT "RadarMissionProgress_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "RadarMission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RadarMissionProgress"
ADD CONSTRAINT "RadarMissionProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RadarMissionProgress"
ADD CONSTRAINT "RadarMissionProgress_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RadarMission" (
  "id", "title", "description", "category", "tag",
  "latitude", "longitude", "radiusMeters", "startsAt", "endsAt",
  "verificationMode", "minimumSeconds", "growthPoints", "badgeName",
  "status", "publishedAt", "updatedAt"
) VALUES
  (
    '73000000-0000-4000-8000-000000000001',
    '中正紀念堂廣場補水確認',
    '在寬敞安全的位置停下來，確認今天是否需要補水或短暫休息。',
    'HYDRATION',
    '補水',
    25.03461,
    121.52177,
    100,
    '2026-01-01T00:00:00.000Z',
    '2027-12-31T23:59:59.000Z',
    'SELF_CHECK',
    NULL,
    6,
    '城市補水者',
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    '華山綠意觀察',
    '在華山周邊觀察一處樹蔭或植栽，記住今天最舒服的一種綠色。',
    'NATURE',
    '觀察',
    25.04411,
    121.52944,
    90,
    '2026-01-01T00:00:00.000Z',
    '2027-12-31T23:59:59.000Z',
    'SELF_CHECK',
    NULL,
    8,
    '城市觀察者',
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '73000000-0000-4000-8000-000000000003',
    '二二八公園三分鐘慢呼吸',
    '找一個不阻礙通行的位置，進行三分鐘慢呼吸，讓身體降速。',
    'WELLNESS',
    '慢呼吸',
    25.04236,
    121.51542,
    90,
    '2026-01-01T00:00:00.000Z',
    '2027-12-31T23:59:59.000Z',
    'TIMER',
    180,
    10,
    '慢呼吸同行者',
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '73000000-0000-4000-8000-000000000004',
    '大安森林公園友善步調',
    '進入公園後選擇今天舒服的步調，不競速、不勉強。',
    'WALK',
    '步行',
    25.03160,
    121.53620,
    120,
    '2026-01-01T00:00:00.000Z',
    '2027-12-31T23:59:59.000Z',
    'SELF_CHECK',
    NULL,
    7,
    '綠肺漫遊者',
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
