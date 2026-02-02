-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RENEWAL_REMINDER';

-- CreateTable
CREATE TABLE "ExternalSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "customDays" INTEGER,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalSubscription_userId_idx" ON "ExternalSubscription"("userId");

-- CreateIndex
CREATE INDEX "ExternalSubscription_userId_isActive_idx" ON "ExternalSubscription"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ExternalSubscription_userId_nextBillingDate_idx" ON "ExternalSubscription"("userId", "nextBillingDate");

-- CreateIndex
CREATE INDEX "ExternalSubscription_nextBillingDate_idx" ON "ExternalSubscription"("nextBillingDate");

-- AddForeignKey
ALTER TABLE "ExternalSubscription" ADD CONSTRAINT "ExternalSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSubscription" ADD CONSTRAINT "ExternalSubscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
