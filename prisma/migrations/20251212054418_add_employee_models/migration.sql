-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sisEmployeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmployeeID" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoUrl" TEXT,
    "expirationDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "employeeId" TEXT NOT NULL,
    CONSTRAINT "EmployeeID_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_sisEmployeeId_key" ON "Employee"("sisEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_email_idx" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_sisEmployeeId_idx" ON "Employee"("sisEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeID_employeeId_key" ON "EmployeeID"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeID_employeeId_idx" ON "EmployeeID"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeID_expirationDate_idx" ON "EmployeeID"("expirationDate");
