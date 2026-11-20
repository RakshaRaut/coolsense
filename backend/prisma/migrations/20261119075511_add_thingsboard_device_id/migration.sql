/*
  Warnings:

  - A unique constraint covering the columns `[thingsboardDeviceId]` on the table `Device` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "thingsboardDeviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Device_thingsboardDeviceId_key" ON "Device"("thingsboardDeviceId");
