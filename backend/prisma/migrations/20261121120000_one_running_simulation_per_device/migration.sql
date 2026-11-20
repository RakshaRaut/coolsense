-- CreateIndex
CREATE UNIQUE INDEX "Simulation_deviceId_key" ON "Simulation"("deviceId") WHERE ("status" = 'RUNNING');

