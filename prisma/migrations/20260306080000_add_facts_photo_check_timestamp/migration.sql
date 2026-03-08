-- Add factsPhotoCheckedAt to track when we last checked FACTS for a profile picture
ALTER TABLE "StudentID" ADD COLUMN "factsPhotoCheckedAt" DateTime(3);
ALTER TABLE "EmployeeID" ADD COLUMN "factsPhotoCheckedAt" DateTime(3);

-- Create index for efficient queries
CREATE INDEX "StudentID_factsPhotoCheckedAt_idx" ON "StudentID"("factsPhotoCheckedAt");
CREATE INDEX "EmployeeID_factsPhotoCheckedAt_idx" ON "EmployeeID"("factsPhotoCheckedAt");
