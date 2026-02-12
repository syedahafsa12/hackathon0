-- AlterTable
ALTER TABLE "Approval" ADD COLUMN "executedAt" DATETIME;
ALTER TABLE "Approval" ADD COLUMN "executionData" TEXT;
ALTER TABLE "Approval" ADD COLUMN "executionError" TEXT;
ALTER TABLE "Approval" ADD COLUMN "executionStatus" TEXT;
