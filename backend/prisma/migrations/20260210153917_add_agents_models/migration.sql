-- CreateTable
CREATE TABLE "NewsCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CEOBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStartDate" DATETIME NOT NULL,
    "weekEndDate" DATETIME NOT NULL,
    "metrics" TEXT NOT NULL,
    "bottlenecks" TEXT NOT NULL,
    "suggestions" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RalphState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 10,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIterationAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'running',
    "completionPromise" TEXT NOT NULL DEFAULT 'TASK_COMPLETE',
    "iterations" TEXT NOT NULL,
    "obsidianStatePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriorityPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "doNow" TEXT NOT NULL,
    "doNext" TEXT NOT NULL,
    "canWait" TEXT NOT NULL,
    "calendarEvents" TEXT NOT NULL,
    "estimatedHours" REAL,
    "filePath" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "NewsCache_userId_expiresAt_idx" ON "NewsCache"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCache_userId_date_category_key" ON "NewsCache"("userId", "date", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CEOBriefing_userId_weekStartDate_key" ON "CEOBriefing"("userId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "RalphState_taskId_key" ON "RalphState"("taskId");

-- CreateIndex
CREATE INDEX "RalphState_userId_status_idx" ON "RalphState"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PriorityPlan_userId_date_key" ON "PriorityPlan"("userId", "date");
