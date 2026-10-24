-- CreateEnum
CREATE TYPE "AdvisorTopic" AS ENUM ('INVEST', 'CROWDFUND', 'SAVINGS', 'CREDIT', 'BUSINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvisorSender" AS ENUM ('USER', 'ADVISOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "AdvisorConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" "AdvisorTopic" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "advisorName" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "AdvisorSender" NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorConversation_userId_lastMessageAt_idx" ON "AdvisorConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AdvisorConversation_status_lastMessageAt_idx" ON "AdvisorConversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AdvisorMessage_conversationId_createdAt_idx" ON "AdvisorMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdvisorConversation" ADD CONSTRAINT "AdvisorConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorMessage" ADD CONSTRAINT "AdvisorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
