-- AlterTable
ALTER TABLE "analysts" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
