-- CreateTable
CREATE TABLE "LinkedInOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hashtags" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready_to_publish',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "remindAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
