-- CreateTable
CREATE TABLE "analysts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customAttributes" TEXT,
    "skills" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "analyst_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "analyst_preferences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vacations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vacations_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scheduling_constraints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT,
    "shiftType" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "constraintType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "scheduling_constraints_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analystId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "isScreener" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "schedules_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "algorithm_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "analysts_email_key" ON "analysts"("email");

-- CreateIndex
CREATE INDEX "analysts_isActive_shiftType_idx" ON "analysts"("isActive", "shiftType");

-- CreateIndex
CREATE INDEX "analysts_email_idx" ON "analysts"("email");

-- CreateIndex
CREATE INDEX "analysts_createdAt_idx" ON "analysts"("createdAt");

-- CreateIndex
CREATE INDEX "analyst_preferences_analystId_shiftType_dayOfWeek_idx" ON "analyst_preferences"("analystId", "shiftType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "analyst_preferences_shiftType_dayOfWeek_idx" ON "analyst_preferences"("shiftType", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "analyst_preferences_analystId_shiftType_dayOfWeek_key" ON "analyst_preferences"("analystId", "shiftType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "vacations_analystId_startDate_endDate_idx" ON "vacations"("analystId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vacations_startDate_endDate_isApproved_idx" ON "vacations"("startDate", "endDate", "isApproved");

-- CreateIndex
CREATE INDEX "vacations_isApproved_idx" ON "vacations"("isApproved");

-- CreateIndex
CREATE INDEX "scheduling_constraints_analystId_startDate_endDate_isActive_idx" ON "scheduling_constraints"("analystId", "startDate", "endDate", "isActive");

-- CreateIndex
CREATE INDEX "scheduling_constraints_startDate_endDate_isActive_idx" ON "scheduling_constraints"("startDate", "endDate", "isActive");

-- CreateIndex
CREATE INDEX "scheduling_constraints_constraintType_isActive_idx" ON "scheduling_constraints"("constraintType", "isActive");

-- CreateIndex
CREATE INDEX "schedules_date_shiftType_idx" ON "schedules"("date", "shiftType");

-- CreateIndex
CREATE INDEX "schedules_analystId_date_idx" ON "schedules"("analystId", "date");

-- CreateIndex
CREATE INDEX "schedules_date_isScreener_idx" ON "schedules"("date", "isScreener");

-- CreateIndex
CREATE INDEX "schedules_analystId_date_shiftType_idx" ON "schedules"("analystId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_analystId_date_key" ON "schedules"("analystId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_configs_name_key" ON "algorithm_configs"("name");

-- CreateIndex
CREATE INDEX "algorithm_configs_isActive_idx" ON "algorithm_configs"("isActive");

-- CreateIndex
CREATE INDEX "algorithm_configs_name_idx" ON "algorithm_configs"("name");
