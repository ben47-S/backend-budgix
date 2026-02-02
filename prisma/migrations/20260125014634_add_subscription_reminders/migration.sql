/*
  Warnings:

  - You are about to drop the column `pinHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pinSetAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PushToken" ADD COLUMN     "subscriptionReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "pinHash",
DROP COLUMN "pinSetAt";
