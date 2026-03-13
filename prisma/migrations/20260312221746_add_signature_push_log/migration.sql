-- CreateTable
CREATE TABLE "SignaturePushLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "pushedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignaturePushLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignaturePushLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SignaturePushLog_employeeId_idx" ON "SignaturePushLog"("employeeId");

-- CreateIndex
CREATE INDEX "SignaturePushLog_templateId_idx" ON "SignaturePushLog"("templateId");

-- CreateIndex
CREATE INDEX "SignaturePushLog_pushedAt_idx" ON "SignaturePushLog"("pushedAt");

-- CreateIndex
CREATE INDEX "SignaturePushLog_success_idx" ON "SignaturePushLog"("success");
