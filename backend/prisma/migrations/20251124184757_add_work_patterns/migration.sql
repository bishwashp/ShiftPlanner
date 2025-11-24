-- CreateTable
CREATE TABLE "work_patterns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "nextPattern" TEXT NOT NULL,
    "breakDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "work_patterns_name_key" ON "work_patterns"("name");

-- CreateIndex
CREATE INDEX "work_patterns_isActive_sortOrder_idx" ON "work_patterns"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "work_patterns_name_isActive_idx" ON "work_patterns"("name", "isActive");
