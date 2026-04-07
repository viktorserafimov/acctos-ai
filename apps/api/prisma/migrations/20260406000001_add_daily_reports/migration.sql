-- CreateTable: daily AI-generated usage reports per tenant
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex: one report per tenant per day
CREATE UNIQUE INDEX "daily_reports_tenantId_date_key" ON "daily_reports"("tenantId", "date");

-- Index: fast lookup by tenant + date
CREATE INDEX "daily_reports_tenantId_date_idx" ON "daily_reports"("tenantId", "date");
