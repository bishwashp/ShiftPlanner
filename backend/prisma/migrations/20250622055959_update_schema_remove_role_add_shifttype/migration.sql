/*
  Warnings:

  - You are about to drop the column `role` on the `analysts` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `schedules` table. All the data in the column will be lost.
  - Added the required column `shiftType` to the `analysts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "analysts" DROP COLUMN "role",
ADD COLUMN     "shiftType" "ShiftType" NOT NULL;

-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "role",
ADD COLUMN     "isScreener" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "Role";
