ALTER TABLE "Device" ADD COLUMN "syncState" JSONB;
ALTER TABLE "Device" ADD COLUMN "syncRevision" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "DeviceEvent_eventKey_key";
CREATE UNIQUE INDEX "DeviceEvent_deviceId_eventKey_key" ON "DeviceEvent"("deviceId", "eventKey");
