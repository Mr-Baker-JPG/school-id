/*
  Warnings:

  - Added the required column `syncType` to the `SyncHistory` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SyncHistory" ("created", "createdAt", "errorMessage", "errors", "id", "success", "syncType", "updated") SELECT "created", "createdAt", "errorMessage", "errors", "id", "success", 'staff', "updated" FROM "SyncHistory";
DROP TABLE "SyncHistory";
ALTER TABLE "new_SyncHistory" RENAME TO "SyncHistory";
CREATE INDEX "SyncHistory_createdAt_idx" ON "SyncHistory"("createdAt");
CREATE INDEX "SyncHistory_syncType_idx" ON "SyncHistory"("syncType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
