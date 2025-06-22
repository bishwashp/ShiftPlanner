-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REGULAR', 'SCREENER');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('PREFERRED', 'AVAILABLE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "analysts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'REGULAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyst_preferences" (
    "id" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "preference" "PreferenceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyst_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "algorithm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysts_email_key" ON "analysts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "analyst_preferences_analystId_shiftType_dayOfWeek_key" ON "analyst_preferences"("analystId", "shiftType", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_analystId_date_key" ON "schedules"("analystId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_configs_name_key" ON "algorithm_configs"("name");

-- AddForeignKey
ALTER TABLE "analyst_preferences" ADD CONSTRAINT "analyst_preferences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
