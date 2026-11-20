CREATE TEMPORARY TABLE "_DeviceIdMap" (
    "oldId" TEXT PRIMARY KEY,
    "newId" TEXT NOT NULL UNIQUE
);

INSERT INTO "_DeviceIdMap" ("oldId", "newId")
SELECT "id", gen_random_uuid()::TEXT
FROM "Device"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "Device" AS device
SET "id" = id_map."newId"
FROM "_DeviceIdMap" AS id_map
WHERE device."id" = id_map."oldId";

ALTER TABLE "Device"
ADD COLUMN "simulationStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN "simulationStartedAt" TIMESTAMP(3);

CREATE TABLE "Telemetry" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulationTime" DOUBLE PRECISION NOT NULL,
    "roomTemperature" DOUBLE PRECISION NOT NULL,
    "targetTemperature" DOUBLE PRECISION NOT NULL,
    "outsideTemperature" DOUBLE PRECISION NOT NULL,
    "roomHumidity" DOUBLE PRECISION NOT NULL,
    "acPower" BOOLEAN NOT NULL,
    "compressorState" BOOLEAN NOT NULL,
    "fanState" BOOLEAN NOT NULL,
    "coolingCapacity" DOUBLE PRECISION NOT NULL,
    "heatingCapacity" DOUBLE PRECISION NOT NULL,
    "powerWatts" DOUBLE PRECISION NOT NULL,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "operatingMode" TEXT NOT NULL,
    "fanSpeed" TEXT NOT NULL,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Telemetry_deviceId_timestamp_idx"
ON "Telemetry"("deviceId", "timestamp");

ALTER TABLE "Telemetry"
ADD CONSTRAINT "Telemetry_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
