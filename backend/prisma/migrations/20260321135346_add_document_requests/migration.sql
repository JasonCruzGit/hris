-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'READY', 'CLOSED');

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "statusNote" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequest_employeeId_createdAt_idx" ON "DocumentRequest"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_createdAt_idx" ON "DocumentRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
