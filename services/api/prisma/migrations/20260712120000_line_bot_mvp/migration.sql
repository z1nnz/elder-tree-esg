CREATE TABLE "LineBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "lineUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LineBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LineBindingCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "lineUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LineBindingCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LineNotificationLog" (
  "id" TEXT NOT NULL,
  "lineBindingId" TEXT,
  "target" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LineNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineBinding_lineUserId_householdId_key"
ON "LineBinding"("lineUserId", "householdId");

CREATE INDEX "LineBinding_userId_householdId_status_idx"
ON "LineBinding"("userId", "householdId", "status");

CREATE UNIQUE INDEX "LineBindingCode_codeHash_key"
ON "LineBindingCode"("codeHash");

CREATE INDEX "LineBindingCode_userId_householdId_expiresAt_idx"
ON "LineBindingCode"("userId", "householdId", "expiresAt");

CREATE INDEX "LineNotificationLog_lineBindingId_createdAt_idx"
ON "LineNotificationLog"("lineBindingId", "createdAt");

CREATE INDEX "LineNotificationLog_type_status_createdAt_idx"
ON "LineNotificationLog"("type", "status", "createdAt");

ALTER TABLE "LineBinding"
ADD CONSTRAINT "LineBinding_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineBinding"
ADD CONSTRAINT "LineBinding_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineBindingCode"
ADD CONSTRAINT "LineBindingCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineBindingCode"
ADD CONSTRAINT "LineBindingCode_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineNotificationLog"
ADD CONSTRAINT "LineNotificationLog_lineBindingId_fkey"
FOREIGN KEY ("lineBindingId") REFERENCES "LineBinding"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
