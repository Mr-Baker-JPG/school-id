-- AlterTable
ALTER TABLE "Student" ADD COLUMN "grade" TEXT;

-- CreateIndex
CREATE INDEX "Student_grade_idx" ON "Student"("grade");
