-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sisStudentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isNameEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Student" ("createdAt", "email", "fullName", "id", "sisStudentId", "status", "updatedAt") SELECT "createdAt", "email", "fullName", "id", "sisStudentId", "status", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_sisStudentId_key" ON "Student"("sisStudentId");
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
CREATE INDEX "Student_email_idx" ON "Student"("email");
CREATE INDEX "Student_status_idx" ON "Student"("status");
CREATE INDEX "Student_sisStudentId_idx" ON "Student"("sisStudentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
