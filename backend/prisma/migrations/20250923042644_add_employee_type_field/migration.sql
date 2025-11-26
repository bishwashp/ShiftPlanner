-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_analysts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "employeeType" TEXT NOT NULL DEFAULT 'employee',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customAttributes" TEXT,
    "skills" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_analysts" ("createdAt", "customAttributes", "email", "id", "isActive", "name", "shiftType", "skills", "updatedAt") SELECT "createdAt", "customAttributes", "email", "id", "isActive", "name", "shiftType", "skills", "updatedAt" FROM "analysts";
DROP TABLE "analysts";
ALTER TABLE "new_analysts" RENAME TO "analysts";
CREATE UNIQUE INDEX "analysts_email_key" ON "analysts"("email");
CREATE INDEX "analysts_isActive_shiftType_idx" ON "analysts"("isActive", "shiftType");
CREATE INDEX "analysts_employeeType_isActive_idx" ON "analysts"("employeeType", "isActive");
CREATE INDEX "analysts_email_idx" ON "analysts"("email");
CREATE INDEX "analysts_createdAt_idx" ON "analysts"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
