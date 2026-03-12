-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "department" TEXT;

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");
