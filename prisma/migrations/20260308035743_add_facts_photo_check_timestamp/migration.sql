/*
  Warnings:

  - You are about to alter the column `factsPhotoCheckedAt` on the `EmployeeID` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("datetime(3)")` to `DateTime`.
  - You are about to alter the column `factsPhotoCheckedAt` on the `StudentID` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("datetime(3)")` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeID" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoUrl" TEXT,
    "expirationDate" DATETIME NOT NULL,
    "factsPhotoCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "employeeId" TEXT NOT NULL,
    CONSTRAINT "EmployeeID_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeID" ("createdAt", "employeeId", "expirationDate", "factsPhotoCheckedAt", "id", "photoUrl", "updatedAt") SELECT "createdAt", "employeeId", "expirationDate", "factsPhotoCheckedAt", "id", "photoUrl", "updatedAt" FROM "EmployeeID";
DROP TABLE "EmployeeID";
ALTER TABLE "new_EmployeeID" RENAME TO "EmployeeID";
CREATE UNIQUE INDEX "EmployeeID_employeeId_key" ON "EmployeeID"("employeeId");
CREATE INDEX "EmployeeID_employeeId_idx" ON "EmployeeID"("employeeId");
CREATE INDEX "EmployeeID_expirationDate_idx" ON "EmployeeID"("expirationDate");
CREATE INDEX "EmployeeID_factsPhotoCheckedAt_idx" ON "EmployeeID"("factsPhotoCheckedAt");
CREATE TABLE "new_StudentID" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoUrl" TEXT,
    "expirationDate" DATETIME NOT NULL,
    "factsPhotoCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "StudentID_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentID" ("createdAt", "expirationDate", "factsPhotoCheckedAt", "id", "photoUrl", "studentId", "updatedAt") SELECT "createdAt", "expirationDate", "factsPhotoCheckedAt", "id", "photoUrl", "studentId", "updatedAt" FROM "StudentID";
DROP TABLE "StudentID";
ALTER TABLE "new_StudentID" RENAME TO "StudentID";
CREATE UNIQUE INDEX "StudentID_studentId_key" ON "StudentID"("studentId");
CREATE INDEX "StudentID_studentId_idx" ON "StudentID"("studentId");
CREATE INDEX "StudentID_expirationDate_idx" ON "StudentID"("expirationDate");
CREATE INDEX "StudentID_factsPhotoCheckedAt_idx" ON "StudentID"("factsPhotoCheckedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
