-- CreateTable
CREATE TABLE "SyncHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "success" BOOLEAN NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SyncHistory_createdAt_idx" ON "SyncHistory"("createdAt");
