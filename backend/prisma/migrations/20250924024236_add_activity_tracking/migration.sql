-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "activities_category_createdAt_idx" ON "activities"("category", "createdAt");

-- CreateIndex
CREATE INDEX "activities_type_createdAt_idx" ON "activities"("type", "createdAt");

-- CreateIndex
CREATE INDEX "activities_performedBy_createdAt_idx" ON "activities"("performedBy", "createdAt");

-- CreateIndex
CREATE INDEX "activities_impact_createdAt_idx" ON "activities"("impact", "createdAt");
