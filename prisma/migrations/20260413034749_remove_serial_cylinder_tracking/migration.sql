-- CreateEnum
CREATE TYPE "BranchCode" AS ENUM ('SBY', 'YOG');

-- CreateEnum
CREATE TYPE "CylinderSize" AS ENUM ('KG12', 'KG50');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DoStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'AGEN', 'INDUSTRI');

-- CreateEnum
CREATE TYPE "WriteoffReason" AS ENUM ('RUSAK_BERAT', 'HILANG', 'KADALUARSA_UJI', 'BOCOR_PARAH');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "GasbackTxType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF', 'SALES_STAFF', 'FINANCE', 'READONLY');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WHATSAPP', 'PHONE', 'WALK_IN', 'SALES_VISIT');

-- CreateEnum
CREATE TYPE "ReturnSource" AS ENUM ('CUSTOMER', 'DRIVER');

-- CreateEnum
CREATE TYPE "CylinderStatus" AS ENUM ('WAREHOUSE_FULL', 'WAREHOUSE_EMPTY', 'IN_TRANSIT', 'WITH_CUSTOMER', 'RETURNED_TO_SUPPLIER', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "EmployeeRoleType" AS ENUM ('DRIVER', 'KENEK', 'WAREHOUSE', 'ADMIN', 'FINANCE', 'SALES', 'BRANCH_MANAGER', 'MECHANIC', 'OTHER');

-- CreateEnum
CREATE TYPE "CylinderEventType" AS ENUM ('RECEIVED_FROM_SUPPLIER', 'DISPATCHED_TO_CUSTOMER', 'RETURNED_FROM_CUSTOMER', 'TRANSFERRED_BETWEEN_BRANCH', 'WRITTEN_OFF', 'INSPECTION');

-- CreateEnum
CREATE TYPE "CylinderCondition" AS ENUM ('GOOD', 'DAMAGED', 'NEEDS_INSPECTION', 'CONDEMNED');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" "BranchCode" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "npwp" VARCHAR(30),
    "address" TEXT,
    "phone" VARCHAR(30),
    "email" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierHmtQuota" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cylinderSize" "CylinderSize" NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "quotaQty" INTEGER NOT NULL,
    "usedQty" INTEGER NOT NULL DEFAULT 0,
    "pricePerUnit" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierHmtQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(120),
    "address" TEXT,
    "npwp" VARCHAR(30),
    "creditLimitKg12" INTEGER NOT NULL DEFAULT 0,
    "creditLimitKg50" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeCode" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRole" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "EmployeeRoleType" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPo" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" VARCHAR(50) NOT NULL,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "kg12Qty" INTEGER NOT NULL DEFAULT 0,
    "kg50Qty" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundReceiving" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierPoId" TEXT,
    "grNumber" VARCHAR(50) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "kg12Received" INTEGER NOT NULL DEFAULT 0,
    "kg12Good" INTEGER NOT NULL DEFAULT 0,
    "kg12Reject" INTEGER NOT NULL DEFAULT 0,
    "kg50Received" INTEGER NOT NULL DEFAULT 0,
    "kg50Good" INTEGER NOT NULL DEFAULT 0,
    "kg50Reject" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundReceiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPo" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "poNumber" VARCHAR(50) NOT NULL,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "OrderChannel",
    "kg12Qty" INTEGER NOT NULL DEFAULT 0,
    "kg50Qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerPoId" TEXT NOT NULL,
    "doNumber" VARCHAR(30) NOT NULL,
    "doDate" DATE NOT NULL,
    "supplierPoRef" VARCHAR(50),
    "driverId" TEXT,
    "kenetId" TEXT,
    "driverName" VARCHAR(120),
    "vehicleNo" VARCHAR(20),
    "status" "DoStatus" NOT NULL DEFAULT 'PENDING',
    "kg12Released" INTEGER NOT NULL DEFAULT 0,
    "kg12Delivered" INTEGER NOT NULL DEFAULT 0,
    "kg50Released" INTEGER NOT NULL DEFAULT 0,
    "kg50Delivered" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmptyReturn" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "returnNumber" VARCHAR(50) NOT NULL,
    "source" "ReturnSource" NOT NULL,
    "customerId" TEXT,
    "driverId" TEXT,
    "kg12Qty" INTEGER NOT NULL DEFAULT 0,
    "kg50Qty" INTEGER NOT NULL DEFAULT 0,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmptyReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderWriteoff" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "writeoffNumber" VARCHAR(50) NOT NULL,
    "reason" "WriteoffReason" NOT NULL,
    "kg12Qty" INTEGER NOT NULL DEFAULT 0,
    "kg50Qty" INTEGER NOT NULL DEFAULT 0,
    "writeoffAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CylinderWriteoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kg12FullQty" INTEGER NOT NULL DEFAULT 0,
    "kg12EmptyQty" INTEGER NOT NULL DEFAULT 0,
    "kg12OnTransitQty" INTEGER NOT NULL DEFAULT 0,
    "kg12HmtQty" INTEGER NOT NULL DEFAULT 0,
    "kg12KuotaWo" INTEGER NOT NULL DEFAULT 0,
    "kg50FullQty" INTEGER NOT NULL DEFAULT 0,
    "kg50EmptyQty" INTEGER NOT NULL DEFAULT 0,
    "kg50OnTransitQty" INTEGER NOT NULL DEFAULT 0,
    "kg50HmtQty" INTEGER NOT NULL DEFAULT 0,
    "kg50KuotaWo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCylinderHolding" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kg12HeldQty" INTEGER NOT NULL DEFAULT 0,
    "kg50HeldQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCylinderHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasbackLedger" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "txType" "GasbackTxType" NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "runningBalance" DECIMAL(14,4) NOT NULL,
    "deliveryOrderId" TEXT,
    "claimId" TEXT,
    "cylinderEventId" TEXT,
    "txDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasbackLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasbackClaim" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "claimNumber" VARCHAR(50) NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paymentRef" VARCHAR(100),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasbackClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRecon" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRecon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "label" VARCHAR(200),
    "notes" TEXT,
    "updatedBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderType" (
    "id" TEXT NOT NULL,
    "size" "CylinderSize" NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "nominalTareKg" DECIMAL(8,3) NOT NULL,
    "nominalFullKg" DECIMAL(8,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CylinderType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderUnit" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serialCode" VARCHAR(60) NOT NULL,
    "typeId" TEXT NOT NULL,
    "tareWeightKg" DECIMAL(8,3),
    "status" "CylinderStatus" NOT NULL DEFAULT 'WAREHOUSE_FULL',
    "condition" "CylinderCondition" NOT NULL DEFAULT 'GOOD',
    "currentCustomerId" TEXT,
    "locationNote" VARCHAR(120),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CylinderUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderEvent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cylinderUnitId" TEXT NOT NULL,
    "eventType" "CylinderEventType" NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "deliveryOrderId" TEXT,
    "emptyReturnId" TEXT,
    "writeoffId" TEXT,
    "customerId" TEXT,
    "weightDispatchedKg" DECIMAL(8,3),
    "weightReturnedKg" DECIMAL(8,3),
    "gasbackKg" DECIMAL(8,3),
    "condition" "CylinderCondition" NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    "recordedBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CylinderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierHmtQuota_supplierId_branchId_cylinderSize_periodMon_key" ON "SupplierHmtQuota"("supplierId", "branchId", "cylinderSize", "periodMonth", "periodYear");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPo_poNumber_key" ON "SupplierPo"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InboundReceiving_grNumber_key" ON "InboundReceiving"("grNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPo_poNumber_key" ON "CustomerPo"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOrder_doNumber_key" ON "DeliveryOrder"("doNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmptyReturn_returnNumber_key" ON "EmptyReturn"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CylinderWriteoff_writeoffNumber_key" ON "CylinderWriteoff"("writeoffNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_branchId_date_key" ON "WarehouseStock"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCylinderHolding_customerId_branchId_key" ON "CustomerCylinderHolding"("customerId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "GasbackClaim_claimNumber_key" ON "GasbackClaim"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRecon_branchId_month_year_key" ON "MonthlyRecon"("branchId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CylinderType_size_key" ON "CylinderType"("size");

-- CreateIndex
CREATE UNIQUE INDEX "CylinderUnit_serialCode_key" ON "CylinderUnit"("serialCode");

-- AddForeignKey
ALTER TABLE "SupplierHmtQuota" ADD CONSTRAINT "SupplierHmtQuota_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierHmtQuota" ADD CONSTRAINT "SupplierHmtQuota_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPo" ADD CONSTRAINT "SupplierPo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPo" ADD CONSTRAINT "SupplierPo_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReceiving" ADD CONSTRAINT "InboundReceiving_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReceiving" ADD CONSTRAINT "InboundReceiving_supplierPoId_fkey" FOREIGN KEY ("supplierPoId") REFERENCES "SupplierPo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPo" ADD CONSTRAINT "CustomerPo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPo" ADD CONSTRAINT "CustomerPo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_customerPoId_fkey" FOREIGN KEY ("customerPoId") REFERENCES "CustomerPo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_kenetId_fkey" FOREIGN KEY ("kenetId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmptyReturn" ADD CONSTRAINT "EmptyReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmptyReturn" ADD CONSTRAINT "EmptyReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmptyReturn" ADD CONSTRAINT "EmptyReturn_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderWriteoff" ADD CONSTRAINT "CylinderWriteoff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCylinderHolding" ADD CONSTRAINT "CustomerCylinderHolding_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCylinderHolding" ADD CONSTRAINT "CustomerCylinderHolding_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackLedger" ADD CONSTRAINT "GasbackLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackLedger" ADD CONSTRAINT "GasbackLedger_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "GasbackClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackLedger" ADD CONSTRAINT "GasbackLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackLedger" ADD CONSTRAINT "GasbackLedger_cylinderEventId_fkey" FOREIGN KEY ("cylinderEventId") REFERENCES "CylinderEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackLedger" ADD CONSTRAINT "GasbackLedger_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackClaim" ADD CONSTRAINT "GasbackClaim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasbackClaim" ADD CONSTRAINT "GasbackClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRecon" ADD CONSTRAINT "MonthlyRecon_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderUnit" ADD CONSTRAINT "CylinderUnit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderUnit" ADD CONSTRAINT "CylinderUnit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CylinderType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_cylinderUnitId_fkey" FOREIGN KEY ("cylinderUnitId") REFERENCES "CylinderUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_emptyReturnId_fkey" FOREIGN KEY ("emptyReturnId") REFERENCES "EmptyReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_writeoffId_fkey" FOREIGN KEY ("writeoffId") REFERENCES "CylinderWriteoff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
