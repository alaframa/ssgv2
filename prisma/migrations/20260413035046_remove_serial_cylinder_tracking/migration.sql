/*
  Warnings:

  - You are about to drop the column `cylinderEventId` on the `GasbackLedger` table. All the data in the column will be lost.
  - You are about to drop the `CylinderEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CylinderUnit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_branchId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_cylinderUnitId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_deliveryOrderId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_emptyReturnId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderEvent" DROP CONSTRAINT "CylinderEvent_writeoffId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderUnit" DROP CONSTRAINT "CylinderUnit_branchId_fkey";

-- DropForeignKey
ALTER TABLE "CylinderUnit" DROP CONSTRAINT "CylinderUnit_typeId_fkey";

-- DropForeignKey
ALTER TABLE "GasbackLedger" DROP CONSTRAINT "GasbackLedger_cylinderEventId_fkey";

-- AlterTable
ALTER TABLE "GasbackLedger" DROP COLUMN "cylinderEventId";

-- DropTable
DROP TABLE "CylinderEvent";

-- DropTable
DROP TABLE "CylinderUnit";

-- DropEnum
DROP TYPE "CylinderCondition";

-- DropEnum
DROP TYPE "CylinderEventType";

-- DropEnum
DROP TYPE "CylinderStatus";
