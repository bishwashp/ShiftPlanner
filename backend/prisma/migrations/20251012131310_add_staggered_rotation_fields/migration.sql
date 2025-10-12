/*
  Warnings:

  - Added the required column `availablePool` to the `rotation_states` table without a default value. This is not possible if the table is not empty.
  - Added the required column `completedPool` to the `rotation_states` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rotation_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmType" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "currentSunThuAnalyst" TEXT,
    "sunThuStartDate" DATETIME,
    "currentTueSatAnalyst" TEXT,
    "tueSatStartDate" DATETIME,
    "availablePool" TEXT NOT NULL,
    "completedPool" TEXT NOT NULL,
    "cycleGeneration" INTEGER NOT NULL DEFAULT 0,
    "completedAnalysts" TEXT,
    "inProgressAnalysts" TEXT,
    "rotationHistory" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_rotation_states" (
  "id", 
  "algorithmType", 
  "shiftType", 
  "currentSunThuAnalyst", 
  "sunThuStartDate",
  "currentTueSatAnalyst", 
  "tueSatStartDate",
  "availablePool", 
  "completedPool", 
  "cycleGeneration",
  "completedAnalysts", 
  "inProgressAnalysts", 
  "rotationHistory",
  "lastUpdated", 
  "createdAt"
) 
SELECT 
  "id", 
  "algorithmType", 
  "shiftType",
  "currentSunThuAnalyst", 
  NULL as "sunThuStartDate",
  "currentTueSatAnalyst", 
  NULL as "tueSatStartDate",
  '[]' as "availablePool",  -- Initialize with empty array
  '[]' as "completedPool",   -- Initialize with empty array
  0 as "cycleGeneration",
  "completedAnalysts", 
  "inProgressAnalysts", 
  "rotationHistory",
  "lastUpdated", 
  "createdAt"
FROM "rotation_states";
DROP TABLE "rotation_states";
ALTER TABLE "new_rotation_states" RENAME TO "rotation_states";
CREATE INDEX "rotation_states_algorithmType_shiftType_idx" ON "rotation_states"("algorithmType", "shiftType");
CREATE INDEX "rotation_states_lastUpdated_idx" ON "rotation_states"("lastUpdated");
CREATE UNIQUE INDEX "rotation_states_algorithmType_shiftType_key" ON "rotation_states"("algorithmType", "shiftType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
