-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'FUNDED', 'DELIVERED', 'DISPUTED', 'RELEASED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowRole" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "EscrowActor" AS ENUM ('BUYER', 'SELLER', 'SYSTEM', 'MEDIATOR');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'ESCROW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_HOLD';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RELEASE';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_REFUND';

-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "initiator" "EscrowRole" NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PROPOSED',
    "deliveryDays" INTEGER NOT NULL,
    "inspectionHours" INTEGER NOT NULL,
    "releaseCode" TEXT,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveryDeadline" TIMESTAMP(3),
    "inspectionEndsAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "sellerAmount" DECIMAL(15,2),
    "buyerAmount" DECIMAL(15,2),
    "resolutionNote" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEvent" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "actor" "EscrowActor" NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_code_key" ON "Escrow"("code");

-- CreateIndex
CREATE INDEX "Escrow_buyerId_createdAt_idx" ON "Escrow"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "Escrow_sellerId_createdAt_idx" ON "Escrow"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Escrow_status_idx" ON "Escrow"("status");

-- CreateIndex
CREATE INDEX "EscrowEvent_escrowId_createdAt_idx" ON "EscrowEvent"("escrowId", "createdAt");

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
