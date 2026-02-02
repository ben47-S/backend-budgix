-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinSetAt" TIMESTAMP(3);
