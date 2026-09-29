-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "record_type" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_logs_level_idx" ON "system_logs"("level");

-- CreateIndex
CREATE INDEX "system_logs_source_event_idx" ON "system_logs"("source", "event");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_record_type_key" ON "retention_policies"("record_type");

-- RLS (defense-in-depth): system/app-layer tables, no direct client access.
-- Writes happen only through the application layer (Prisma role bypasses RLS).
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retention_policies" ENABLE ROW LEVEL SECURITY;