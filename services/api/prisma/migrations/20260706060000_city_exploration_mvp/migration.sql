CREATE TYPE "ExplorationRouteStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ExplorationSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

CREATE TABLE "ExplorationRoute" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "badgeName" TEXT NOT NULL,
  "badgeAssetKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ExplorationRouteStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExplorationRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExplorationSession" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "status" "ExplorationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "distanceMeters" INTEGER NOT NULL DEFAULT 0,
  "lastLatitude" DOUBLE PRECISION,
  "lastLongitude" DOUBLE PRECISION,
  "lastAccuracy" DOUBLE PRECISION,
  "lastEventAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ExplorationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExplorationRouteAward" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExplorationRouteAward_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MapQuest"
ADD COLUMN "routeId" TEXT,
ADD COLUMN "sequence" INTEGER,
ADD COLUMN "locationName" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "safetyNote" TEXT,
ADD COLUMN "accessibilityTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sourceUrl" TEXT;

INSERT INTO "ExplorationRoute" (
  "id", "slug", "name", "description", "badgeName", "badgeAssetKey",
  "version", "status", "archivedAt", "updatedAt"
)
SELECT
  '70000000-0000-4000-8000-000000000000',
  'legacy-exploration',
  '既有探索任務',
  '升級前建立的探索任務。',
  '早期探索者',
  'legacy-leaf',
  1,
  'ARCHIVED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "MapQuest");

WITH ranked AS (
  SELECT
    mq."id",
    ROW_NUMBER() OVER (ORDER BY mq."createdAt", mq."id") AS sequence,
    task."title"
  FROM "MapQuest" mq
  JOIN "Task" task ON task."id" = mq."taskId"
)
UPDATE "MapQuest" mq
SET
  "routeId" = '70000000-0000-4000-8000-000000000000',
  "sequence" = ranked.sequence,
  "locationName" = ranked."title",
  "category" = 'LEGACY'
FROM ranked
WHERE ranked."id" = mq."id";

ALTER TABLE "MapQuest"
ALTER COLUMN "routeId" SET NOT NULL,
ALTER COLUMN "sequence" SET NOT NULL,
ALTER COLUMN "locationName" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL;

ALTER TABLE "LocationEventReceipt" ADD COLUMN "sessionId" TEXT;

CREATE UNIQUE INDEX "ExplorationRoute_slug_key"
ON "ExplorationRoute"("slug");
CREATE UNIQUE INDEX "MapQuest_routeId_sequence_key"
ON "MapQuest"("routeId", "sequence");
CREATE INDEX "MapQuest_routeId_active_idx"
ON "MapQuest"("routeId", "active");
CREATE INDEX "ExplorationSession_userId_householdId_status_idx"
ON "ExplorationSession"("userId", "householdId", "status");
CREATE INDEX "ExplorationSession_routeId_status_idx"
ON "ExplorationSession"("routeId", "status");
CREATE UNIQUE INDEX "ExplorationRouteAward_routeId_userId_householdId_key"
ON "ExplorationRouteAward"("routeId", "userId", "householdId");
CREATE INDEX "ExplorationRouteAward_userId_householdId_idx"
ON "ExplorationRouteAward"("userId", "householdId");
CREATE INDEX "LocationEventReceipt_sessionId_occurredAt_idx"
ON "LocationEventReceipt"("sessionId", "occurredAt");

ALTER TABLE "MapQuest"
ADD CONSTRAINT "MapQuest_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "ExplorationRoute"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationSession"
ADD CONSTRAINT "ExplorationSession_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "ExplorationRoute"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationSession"
ADD CONSTRAINT "ExplorationSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationSession"
ADD CONSTRAINT "ExplorationSession_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationRouteAward"
ADD CONSTRAINT "ExplorationRouteAward_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "ExplorationRoute"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationRouteAward"
ADD CONSTRAINT "ExplorationRouteAward_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplorationRouteAward"
ADD CONSTRAINT "ExplorationRouteAward_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationEventReceipt"
ADD CONSTRAINT "LocationEventReceipt_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ExplorationSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ExplorationRoute" (
  "id", "slug", "name", "description", "badgeName", "badgeAssetKey",
  "version", "status", "publishedAt", "updatedAt"
) VALUES (
  '70000000-0000-4000-8000-000000000001',
  'daan-forest-first-walk',
  '都市綠肺初探',
  '從捷運走進大安森林公園，用舒服的步調感受植物、鳥鳴與城市藝術。',
  '都市綠肺初探',
  'urban-green-lung',
  1,
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Task" (
  "id", "title", "description", "verificationMode", "verificationRule",
  "growthPoints", "createdAt", "updatedAt"
) VALUES
  ('71000000-0000-4000-8000-000000000001', '選擇今天舒服的步調', '抵達捷運 5 號出口後，感受身體狀況，選擇不勉強自己的速度。', 'SELF_CHECK', '{"source":"exploration"}'::jsonb, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000002', '找到今天最喜歡的顏色', '在百花園或噴水池附近，觀察一種讓自己心情平靜的顏色。', 'SELF_CHECK', '{"source":"exploration"}'::jsonb, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000003', '安靜聆聽自然三分鐘', '在大生態池旁停下來，聽三分鐘的風聲、水聲或鳥鳴。', 'TIMER', '{"source":"exploration","minimumSeconds":180}'::jsonb, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000004', '友善觀察城市鳥類', '在觀景平台看看周遭鳥類，不靠近、不追逐，也不餵食。', 'SELF_CHECK', '{"source":"exploration"}'::jsonb, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000005', '五分鐘溫和伸展', '在露天音樂臺附近找安全平坦的位置，進行五分鐘溫和伸展。', 'TIMER', '{"source":"exploration","minimumSeconds":300}'::jsonb, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000006', '第一段散步補水確認', '累積走過 400 公尺後，停下來確認是否需要補水或休息。', 'SELF_CHECK', '{"source":"exploration"}'::jsonb, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('71000000-0000-4000-8000-000000000007', '完成綠徑回顧', '完成一公里後，回想今天最喜歡的一個片刻。', 'SELF_CHECK', '{"source":"exploration"}'::jsonb, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MapQuest" (
  "id", "taskId", "routeId", "sequence", "locationName", "category",
  "safetyNote", "accessibilityTags", "sourceUrl", "triggerType",
  "latitude", "longitude", "radiusMeters", "unlockDistanceMeters",
  "active", "createdAt", "updatedAt"
) VALUES
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 1, '大安森林公園站 5 號出口', 'TRANSIT', '先在出口旁確認方向與身體狀況；無障礙資訊待現場確認。', ARRAY['待確認'], 'https://travel.taipei/zh-tw/news/details/65591', 'GEOFENCE', 25.03367, 121.53566, 60, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 2, '百花園與噴水池', 'NATURE', '請留在步道，不採摘植物；設施資訊待現場確認。', ARRAY['待確認'], 'https://travel.taipei/zh-tw/news/details/26935', 'GEOFENCE', 25.03267, 121.53513, 70, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 3, '大生態池', 'NATURE', '池邊請慢行並與水域保持距離；座椅與廁所資訊待現場確認。', ARRAY['待確認'], 'https://travel.taipei/zh-tw/news/details/65591', 'GEOFENCE', 25.03062, 121.53664, 75, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', 4, '落羽松觀景平台', 'NATURE', '不餵食、不追逐鳥類；平台狀況與無障礙資訊待現場確認。', ARRAY['待確認'], 'https://travel.taipei/zh-tw/news/details/65591', 'GEOFENCE', 25.03045, 121.53710, 65, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 5, '露天音樂臺', 'ARTS', '只做舒服、不疼痛的動作，若場地有活動請改在附近安全處。', ARRAY['待確認'], 'https://travel.taipei/zh-tw/media/audio-guide/details/194', 'GEOFENCE', 25.02988, 121.53637, 75, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', 6, '路線累積 400 公尺', 'DISTANCE', '感到喘、暈或疼痛時請立即停止並休息。', ARRAY['不限定地點'], 'https://travel.taipei/zh-tw/media/audio-guide/details/194', 'DISTANCE', NULL, NULL, NULL, 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000001', 7, '路線累積 1,000 公尺', 'DISTANCE', '不必一次走完；以身體舒適為優先。', ARRAY['不限定地點'], 'https://travel.taipei/zh-tw/media/audio-guide/details/194', 'DISTANCE', NULL, NULL, NULL, 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
