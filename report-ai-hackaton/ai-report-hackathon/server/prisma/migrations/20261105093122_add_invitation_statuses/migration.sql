-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "OrganizationInvitation" ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING';
