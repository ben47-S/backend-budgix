-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DiscussionStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DiscussionStatus" NOT NULL DEFAULT 'OPEN',
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderType" "MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Discussion_userId_idx" ON "Discussion"("userId");

-- CreateIndex
CREATE INDEX "Discussion_status_idx" ON "Discussion"("status");

-- CreateIndex
CREATE INDEX "Discussion_lastActivityAt_idx" ON "Discussion"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Discussion_userId_status_idx" ON "Discussion"("userId", "status");

-- CreateIndex
CREATE INDEX "Message_discussionId_idx" ON "Message"("discussionId");

-- CreateIndex
CREATE INDEX "Message_discussionId_createdAt_idx" ON "Message"("discussionId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
