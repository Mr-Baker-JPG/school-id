-- AlterTable
ALTER TABLE "EmployeeID" ADD COLUMN "gmailSignature" TEXT;
ALTER TABLE "EmployeeID" ADD COLUMN "gmailSignatureFetchedAt" DATETIME;

-- CreateIndex
CREATE INDEX "EmployeeID_gmailSignatureFetchedAt_idx" ON "EmployeeID"("gmailSignatureFetchedAt");
