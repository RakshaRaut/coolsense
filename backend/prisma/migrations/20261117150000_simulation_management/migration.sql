CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "config" JSONB NOT NULL,
    "currentState" JSONB NOT NULL,
    "initialState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimulationSnapshot" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulationTime" DOUBLE PRECISION NOT NULL,
    "state" JSONB NOT NULL,

    CONSTRAINT "SimulationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Simulation_deviceId_status_idx" ON "Simulation"("deviceId", "status");
CREATE INDEX "Simulation_updatedAt_idx" ON "Simulation"("updatedAt");
CREATE INDEX "SimulationSnapshot_simulationId_timestamp_idx"
ON "SimulationSnapshot"("simulationId", "timestamp");

ALTER TABLE "Simulation"
ADD CONSTRAINT "Simulation_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulationSnapshot"
ADD CONSTRAINT "SimulationSnapshot_simulationId_fkey"
FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
