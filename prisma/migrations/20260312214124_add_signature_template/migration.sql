-- CreateTable
CREATE TABLE "SignatureTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureTemplate_name_key" ON "SignatureTemplate"("name");

-- CreateIndex
CREATE INDEX "SignatureTemplate_isDefault_idx" ON "SignatureTemplate"("isDefault");
