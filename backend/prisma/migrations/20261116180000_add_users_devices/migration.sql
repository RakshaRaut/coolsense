-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acType" TEXT NOT NULL DEFAULT 'NON_INVERTER',
    "roomVolume" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "outsideTemperature" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "initialRoomTemperature" DOUBLE PRECISION NOT NULL DEFAULT 32,
    "targetTemperature" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "ratedCoolingCapacity" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "ratedHeatingCapacity" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "ratedPowerWatts" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "heatLoadKw" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "thermostatDifferential" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "simulationSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "thermalCapacityKwhPerC" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "thermalConductanceKwPerC" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "fanPowerWatts" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "simulationTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roomTemperature" DOUBLE PRECISION NOT NULL DEFAULT 32,
    "roomHumidity" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "acPower" BOOLEAN NOT NULL DEFAULT false,
    "compressorState" BOOLEAN NOT NULL DEFAULT false,
    "fanState" BOOLEAN NOT NULL DEFAULT false,
    "coolingCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heatingCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "powerWatts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "energyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operatingMode" TEXT NOT NULL DEFAULT 'COOL',
    "fanSpeed" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Device_ownerId_idx" ON "Device"("ownerId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
