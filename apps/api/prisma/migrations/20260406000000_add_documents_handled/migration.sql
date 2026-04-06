-- AlterTable: add documentsHandled to document_usage_events
ALTER TABLE "document_usage_events" ADD COLUMN "documentsHandled" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add documentsHandled to document_usage_aggregates
ALTER TABLE "document_usage_aggregates" ADD COLUMN "documentsHandled" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add documentsHandled to monthly_usage_snapshots
ALTER TABLE "monthly_usage_snapshots" ADD COLUMN "documentsHandled" INTEGER NOT NULL DEFAULT 0;
