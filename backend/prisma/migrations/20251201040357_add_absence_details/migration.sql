-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "changes" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "fairness_debts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "absenceId" TEXT,
    "debtAmount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "fairness_debts_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fairness_debts_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "absences" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "replacement_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalAnalystId" TEXT NOT NULL,
    "replacementAnalystId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reassignmentChain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "replacement_assignments_originalAnalystId_fkey" FOREIGN KEY ("originalAnalystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "replacement_assignments_replacementAnalystId_fkey" FOREIGN KEY ("replacementAnalystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_absences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isPlanned" BOOLEAN NOT NULL DEFAULT true,
    "isPartialDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "fractionalUnits" REAL NOT NULL DEFAULT 1.0,
    "excludedHolidayDates" TEXT,
    "workDaysCount" INTEGER NOT NULL DEFAULT 0,
    "impactScore" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "absences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_absences" ("analystId", "createdAt", "endDate", "id", "isApproved", "isPlanned", "reason", "startDate", "type", "updatedAt") SELECT "analystId", "createdAt", "endDate", "id", "isApproved", "isPlanned", "reason", "startDate", "type", "updatedAt" FROM "absences";
DROP TABLE "absences";
ALTER TABLE "new_absences" RENAME TO "absences";
CREATE INDEX "absences_analystId_startDate_endDate_idx" ON "absences"("analystId", "startDate", "endDate");
CREATE INDEX "absences_startDate_endDate_isApproved_idx" ON "absences"("startDate", "endDate", "isApproved");
CREATE INDEX "absences_type_isApproved_idx" ON "absences"("type", "isApproved");
CREATE INDEX "absences_isPlanned_isApproved_idx" ON "absences"("isPlanned", "isApproved");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "system_events_eventType_createdAt_idx" ON "system_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "system_events_entityType_entityId_idx" ON "system_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "fairness_debts_analystId_resolvedAt_idx" ON "fairness_debts"("analystId", "resolvedAt");

-- CreateIndex
CREATE INDEX "replacement_assignments_date_status_idx" ON "replacement_assignments"("date", "status");

-- CreateIndex
CREATE INDEX "replacement_assignments_originalAnalystId_idx" ON "replacement_assignments"("originalAnalystId");

-- CreateIndex
CREATE INDEX "replacement_assignments_replacementAnalystId_idx" ON "replacement_assignments"("replacementAnalystId");
