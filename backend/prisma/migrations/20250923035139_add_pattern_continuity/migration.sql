-- CreateTable
CREATE TABLE "pattern_continuity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "algorithmType" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "lastPattern" TEXT NOT NULL,
    "lastWorkDate" DATETIME NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "metadata" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pattern_continuity_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "analysts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "pattern_continuity_algorithmType_updatedAt_idx" ON "pattern_continuity"("algorithmType", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_continuity_algorithmType_analystId_key" ON "pattern_continuity"("algorithmType", "analystId");
