-- CreateTable
CREATE TABLE "schedule_generation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedBy" TEXT NOT NULL DEFAULT 'admin',
    "algorithmType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "schedulesGenerated" INTEGER NOT NULL,
    "conflictsDetected" INTEGER NOT NULL DEFAULT 0,
    "fairnessScore" REAL,
    "executionTime" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "schedule_generation_logs_createdAt_idx" ON "schedule_generation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "schedule_generation_logs_generatedBy_createdAt_idx" ON "schedule_generation_logs"("generatedBy", "createdAt");

-- CreateIndex
CREATE INDEX "schedule_generation_logs_algorithmType_createdAt_idx" ON "schedule_generation_logs"("algorithmType", "createdAt");

-- CreateIndex
CREATE INDEX "schedule_generation_logs_status_createdAt_idx" ON "schedule_generation_logs"("status", "createdAt");
