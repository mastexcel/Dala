-- AlterEnum
ALTER TYPE "AdvisorTopic" ADD VALUE 'PAYMENTS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "dateOfBirth" DATE;
