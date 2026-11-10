-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('GOVERNMENT', 'COMPANY', 'SCHOOL', 'HOSPITAL', 'NGO', 'COMMUNITY', 'OTHER');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "type" "OrganizationType";
