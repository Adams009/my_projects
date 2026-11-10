ALTER TABLE "Location"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Location_active_name_per_organization_key"
ON "Location" ("organizationId", LOWER("name"))
WHERE "isActive" = true;
