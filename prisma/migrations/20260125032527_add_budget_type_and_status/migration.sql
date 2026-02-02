-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DEPASSE', 'EN_COURS', 'A_VENIR');

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "type" "BudgetType" NOT NULL DEFAULT 'CUSTOM';

-- CreateIndex
CREATE INDEX "Budget_userId_type_idx" ON "Budget"("userId", "type");

-- CreateIndex
CREATE INDEX "Budget_userId_type_periodStart_periodEnd_idx" ON "Budget"("userId", "type", "periodStart", "periodEnd");
