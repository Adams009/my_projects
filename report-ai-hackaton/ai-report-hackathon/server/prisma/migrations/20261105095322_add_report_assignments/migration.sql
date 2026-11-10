-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentReviewStatus" AS ENUM ('NOT_REVIEWED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ReportAssignment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "AssignmentReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportAssignment_reportId_idx" ON "ReportAssignment"("reportId");

-- CreateIndex
CREATE INDEX "ReportAssignment_teamId_idx" ON "ReportAssignment"("teamId");

-- CreateIndex
CREATE INDEX "ReportAssignment_assignedById_idx" ON "ReportAssignment"("assignedById");

-- CreateIndex
CREATE INDEX "ReportAssignment_reviewedById_idx" ON "ReportAssignment"("reviewedById");

-- CreateIndex
CREATE INDEX "ReportAssignment_status_idx" ON "ReportAssignment"("status");

-- CreateIndex
CREATE INDEX "ReportAssignment_reviewStatus_idx" ON "ReportAssignment"("reviewStatus");

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
