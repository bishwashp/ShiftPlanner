-- CreateTable
CREATE TABLE "comp_off_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "earnedDate" DATETIME,
    "compOffDate" DATETIME,
    "reason" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "isAutoAssigned" BOOLEAN NOT NULL DEFAULT false,
    "isBanked" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comp_off_transactions_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_workloads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "scheduledWorkDays" INTEGER NOT NULL DEFAULT 0,
    "weekendWorkDays" INTEGER NOT NULL DEFAULT 0,
    "holidayWorkDays" INTEGER NOT NULL DEFAULT 0,
    "overtimeDays" INTEGER NOT NULL DEFAULT 0,
    "autoCompOffDays" INTEGER NOT NULL DEFAULT 0,
    "bankedCompOffDays" INTEGER NOT NULL DEFAULT 0,
    "totalWorkDays" INTEGER NOT NULL DEFAULT 0,
    "isBalanced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "weekly_workloads_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workload_violations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workloadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL,
    "affectedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workload_violations_workloadId_fkey" FOREIGN KEY ("workloadId") REFERENCES "weekly_workloads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rotation_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmType" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "currentSunThuAnalyst" TEXT,
    "currentTueSatAnalyst" TEXT,
    "completedAnalysts" TEXT NOT NULL,
    "inProgressAnalysts" TEXT NOT NULL,
    "rotationHistory" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "comp_off_transactions_analystId_createdAt_idx" ON "comp_off_transactions"("analystId", "createdAt");

-- CreateIndex
CREATE INDEX "comp_off_transactions_earnedDate_idx" ON "comp_off_transactions"("earnedDate");

-- CreateIndex
CREATE INDEX "comp_off_transactions_compOffDate_idx" ON "comp_off_transactions"("compOffDate");

-- CreateIndex
CREATE INDEX "comp_off_transactions_type_reason_idx" ON "comp_off_transactions"("type", "reason");

-- CreateIndex
CREATE INDEX "comp_off_transactions_isAutoAssigned_isBanked_idx" ON "comp_off_transactions"("isAutoAssigned", "isBanked");

-- CreateIndex
CREATE INDEX "weekly_workloads_analystId_weekStart_idx" ON "weekly_workloads"("analystId", "weekStart");

-- CreateIndex
CREATE INDEX "weekly_workloads_weekStart_weekEnd_idx" ON "weekly_workloads"("weekStart", "weekEnd");

-- CreateIndex
CREATE INDEX "weekly_workloads_isBalanced_idx" ON "weekly_workloads"("isBalanced");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_workloads_analystId_weekStart_key" ON "weekly_workloads"("analystId", "weekStart");

-- CreateIndex
CREATE INDEX "workload_violations_workloadId_idx" ON "workload_violations"("workloadId");

-- CreateIndex
CREATE INDEX "workload_violations_type_severity_idx" ON "workload_violations"("type", "severity");

-- CreateIndex
CREATE INDEX "workload_violations_affectedDate_idx" ON "workload_violations"("affectedDate");

-- CreateIndex
CREATE INDEX "rotation_states_algorithmType_shiftType_idx" ON "rotation_states"("algorithmType", "shiftType");

-- CreateIndex
CREATE INDEX "rotation_states_lastUpdated_idx" ON "rotation_states"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "rotation_states_algorithmType_shiftType_key" ON "rotation_states"("algorithmType", "shiftType");
