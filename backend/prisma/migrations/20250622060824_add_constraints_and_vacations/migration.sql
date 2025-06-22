-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('BLACKOUT_DATE', 'MAX_SCREENER_DAYS', 'MIN_SCREENER_DAYS', 'PREFERRED_SCREENER', 'UNAVAILABLE_SCREENER');

-- CreateTable
CREATE TABLE "vacations" (
    "id" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_constraints" (
    "id" TEXT NOT NULL,
    "analystId" TEXT,
    "shiftType" "ShiftType",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "constraintType" "ConstraintType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_constraints_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_constraints" ADD CONSTRAINT "scheduling_constraints_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
