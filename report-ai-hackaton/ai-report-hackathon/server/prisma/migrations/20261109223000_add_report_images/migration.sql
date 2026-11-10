CREATE TABLE "ReportImage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportImage_reportId_idx" ON "ReportImage"("reportId");

ALTER TABLE "ReportImage"
ADD CONSTRAINT "ReportImage_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
