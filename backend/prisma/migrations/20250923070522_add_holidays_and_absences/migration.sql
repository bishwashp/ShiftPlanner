-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isPlanned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "absences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "holidays_date_timezone_isActive_idx" ON "holidays"("date", "timezone", "isActive");

-- CreateIndex
CREATE INDEX "holidays_year_isActive_idx" ON "holidays"("year", "isActive");

-- CreateIndex
CREATE INDEX "holidays_isRecurring_isActive_idx" ON "holidays"("isRecurring", "isActive");

-- CreateIndex
CREATE INDEX "absences_analystId_startDate_endDate_idx" ON "absences"("analystId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "absences_startDate_endDate_isApproved_idx" ON "absences"("startDate", "endDate", "isApproved");

-- CreateIndex
CREATE INDEX "absences_type_isApproved_idx" ON "absences"("type", "isApproved");

-- CreateIndex
CREATE INDEX "absences_isPlanned_isApproved_idx" ON "absences"("isPlanned", "isApproved");
