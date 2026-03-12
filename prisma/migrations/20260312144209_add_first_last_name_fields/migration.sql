/*
  Warnings:

  - Added the required column `firstName` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sisEmployeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Migrate Employee data
-- Extract first word as firstName, everything after last space as lastName
-- This is a best-effort migration; actual values will be populated from FACTS sync
INSERT INTO "new_Employee" (
  "id", "sisEmployeeId", "firstName", "lastName", "fullName", "jobTitle", "email", "status", "createdAt", "updatedAt"
)
SELECT 
  "id",
  "sisEmployeeId",
  -- firstName: first word (or whole string if no space)
  CASE 
    WHEN instr("fullName", ' ') = 0 THEN "fullName"
    ELSE substr("fullName", 1, instr("fullName", ' ') - 1)
  END,
  -- lastName: last word (find last space using rtrim trick)
  CASE 
    WHEN instr("fullName", ' ') = 0 THEN "fullName"
    ELSE replace("fullName", rtrim("fullName", replace("fullName", ' ', '')), '')
  END,
  "fullName",
  "jobTitle",
  "email",
  "status",
  "createdAt",
  "updatedAt"
FROM "Employee";

DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_sisEmployeeId_key" ON "Employee"("sisEmployeeId");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE INDEX "Employee_email_idx" ON "Employee"("email");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE INDEX "Employee_sisEmployeeId_idx" ON "Employee"("sisEmployeeId");

CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sisStudentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "grade" TEXT,
    "status" TEXT NOT NULL,
    "isNameEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Migrate Student data
INSERT INTO "new_Student" (
  "id", "sisStudentId", "firstName", "lastName", "fullName", "email", "grade", "status", "isNameEdited", "createdAt", "updatedAt"
)
SELECT 
  "id",
  "sisStudentId",
  -- firstName: first word (or whole string if no space)
  CASE 
    WHEN instr("fullName", ' ') = 0 THEN "fullName"
    ELSE substr("fullName", 1, instr("fullName", ' ') - 1)
  END,
  -- lastName: last word
  CASE 
    WHEN instr("fullName", ' ') = 0 THEN "fullName"
    ELSE replace("fullName", rtrim("fullName", replace("fullName", ' ', '')), '')
  END,
  "fullName",
  "email",
  "grade",
  "status",
  "isNameEdited",
  "createdAt",
  "updatedAt"
FROM "Student";

DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_sisStudentId_key" ON "Student"("sisStudentId");
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
CREATE INDEX "Student_email_idx" ON "Student"("email");
CREATE INDEX "Student_status_idx" ON "Student"("status");
CREATE INDEX "Student_sisStudentId_idx" ON "Student"("sisStudentId");
CREATE INDEX "Student_grade_idx" ON "Student"("grade");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
