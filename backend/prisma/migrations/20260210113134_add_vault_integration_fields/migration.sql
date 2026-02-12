-- AlterTable
ALTER TABLE "KnowledgeEntry" ADD COLUMN "filePath" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "requesterId" TEXT,
    "responderId" TEXT,
    "rejectionReason" TEXT,
    "executedAt" DATETIME,
    "executionStatus" TEXT,
    "executionError" TEXT,
    "executionData" TEXT,
    "obsidianPath" TEXT,
    "obsidianSynced" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME
);
INSERT INTO "new_Approval" ("actionData", "actionType", "executedAt", "executionData", "executionError", "executionStatus", "id", "rejectionReason", "requestedAt", "requesterId", "respondedAt", "responderId", "status", "userId") SELECT "actionData", "actionType", "executedAt", "executionData", "executionError", "executionStatus", "id", "rejectionReason", "requestedAt", "requesterId", "respondedAt", "responderId", "status", "userId" FROM "Approval";
DROP TABLE "Approval";
ALTER TABLE "new_Approval" RENAME TO "Approval";
CREATE INDEX "Approval_obsidianPath_idx" ON "Approval"("obsidianPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KnowledgeEntry_filePath_idx" ON "KnowledgeEntry"("filePath");
