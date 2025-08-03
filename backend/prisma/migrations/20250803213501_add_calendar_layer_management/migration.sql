/*
  Warnings:

  - The primary key for the `calendar_layer_preferences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `analyst_id` on the `calendar_layer_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `calendar_layer_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `layer_id` on the `calendar_layer_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `order_index` on the `calendar_layer_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `calendar_layer_preferences` table. All the data in the column will be lost.
  - The primary key for the `view_preferences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `analyst_id` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `default_layers` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `show_conflicts` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `show_fairness_indicators` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `view_type` on the `view_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `zoom_level` on the `view_preferences` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[analystId,layerId]` on the table `calendar_layer_preferences` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[analystId,viewType]` on the table `view_preferences` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `analystId` to the `calendar_layer_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layerId` to the `calendar_layer_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `calendar_layer_preferences` table without a default value. This is not possible if the table is not empty.
  - Made the column `enabled` on table `calendar_layer_preferences` required. This step will fail if there are existing NULL values in that column.
  - Made the column `opacity` on table `calendar_layer_preferences` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `calendar_layer_preferences` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `analystId` to the `view_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `view_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `viewType` to the `view_preferences` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "calendar_layer_preferences" DROP CONSTRAINT "calendar_layer_preferences_analyst_id_fkey";

-- DropForeignKey
ALTER TABLE "view_preferences" DROP CONSTRAINT "view_preferences_analyst_id_fkey";

-- DropIndex
DROP INDEX "calendar_layer_preferences_analyst_id_layer_id_key";

-- DropIndex
DROP INDEX "idx_calendar_layer_preferences_analyst_id";

-- DropIndex
DROP INDEX "idx_calendar_layer_preferences_layer_id";

-- DropIndex
DROP INDEX "idx_view_preferences_analyst_id";

-- DropIndex
DROP INDEX "idx_view_preferences_view_type";

-- DropIndex
DROP INDEX "view_preferences_analyst_id_view_type_key";

-- AlterTable
ALTER TABLE "calendar_layer_preferences" DROP CONSTRAINT "calendar_layer_preferences_pkey",
DROP COLUMN "analyst_id",
DROP COLUMN "created_at",
DROP COLUMN "layer_id",
DROP COLUMN "order_index",
DROP COLUMN "updated_at",
ADD COLUMN     "analystId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "layerId" TEXT NOT NULL,
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "enabled" SET NOT NULL,
ALTER COLUMN "opacity" SET NOT NULL,
ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "color" SET DATA TYPE TEXT,
ADD CONSTRAINT "calendar_layer_preferences_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "view_preferences" DROP CONSTRAINT "view_preferences_pkey",
DROP COLUMN "analyst_id",
DROP COLUMN "created_at",
DROP COLUMN "default_layers",
DROP COLUMN "show_conflicts",
DROP COLUMN "show_fairness_indicators",
DROP COLUMN "updated_at",
DROP COLUMN "view_type",
DROP COLUMN "zoom_level",
ADD COLUMN     "analystId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultLayers" TEXT[],
ADD COLUMN     "showConflicts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showFairnessIndicators" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "viewType" TEXT NOT NULL,
ADD COLUMN     "zoomLevel" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "view_preferences_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "calendar_layer_preferences_analystId_idx" ON "calendar_layer_preferences"("analystId");

-- CreateIndex
CREATE INDEX "calendar_layer_preferences_layerId_idx" ON "calendar_layer_preferences"("layerId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_layer_preferences_analystId_layerId_key" ON "calendar_layer_preferences"("analystId", "layerId");

-- CreateIndex
CREATE INDEX "view_preferences_analystId_idx" ON "view_preferences"("analystId");

-- CreateIndex
CREATE INDEX "view_preferences_viewType_idx" ON "view_preferences"("viewType");

-- CreateIndex
CREATE UNIQUE INDEX "view_preferences_analystId_viewType_key" ON "view_preferences"("analystId", "viewType");

-- AddForeignKey
ALTER TABLE "calendar_layer_preferences" ADD CONSTRAINT "calendar_layer_preferences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_preferences" ADD CONSTRAINT "view_preferences_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
