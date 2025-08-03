-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'ROTATION', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MAJOR_RELEASE', 'MINOR_RELEASE', 'HOLIDAY', 'PARTNER_DOWNTIME');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('SHIFT', 'EVENT', 'PARTNER');

-- AlterTable
ALTER TABLE "analysts" ADD COLUMN     "employeeType" "EmployeeType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'JUNIOR';

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'HOLIDAY',
    "calendarType" "CalendarType" NOT NULL DEFAULT 'EVENT',
    "description" TEXT,
    "defaultConstraints" JSONB NOT NULL,
    "overrideConstraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_startDate_endDate_calendarType_idx" ON "calendar_events"("startDate", "endDate", "calendarType");

-- CreateIndex
CREATE INDEX "calendar_events_eventType_idx" ON "calendar_events"("eventType");

-- CreateIndex
CREATE INDEX "calendar_events_calendarType_idx" ON "calendar_events"("calendarType");

-- CreateIndex
CREATE INDEX "analysts_experienceLevel_employeeType_idx" ON "analysts"("experienceLevel", "employeeType");
