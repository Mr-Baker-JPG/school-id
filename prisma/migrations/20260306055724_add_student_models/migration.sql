-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sisStudentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentID" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoUrl" TEXT,
    "expirationDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "StudentID_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_sisStudentId_key" ON "Student"("sisStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_email_idx" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_sisStudentId_idx" ON "Student"("sisStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentID_studentId_key" ON "StudentID"("studentId");

-- CreateIndex
CREATE INDEX "StudentID_studentId_idx" ON "StudentID"("studentId");

-- CreateIndex
CREATE INDEX "StudentID_expirationDate_idx" ON "StudentID"("expirationDate");
