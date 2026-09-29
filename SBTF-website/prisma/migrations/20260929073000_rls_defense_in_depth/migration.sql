-- RLS (defense-in-depth) for the SBTF schema.
--
-- NOTE: The Prisma connection role bypasses RLS (it owns the tables). These
-- policies constrain *direct* table access from other roles (e.g. Supabase
-- anon/authenticated, or a future dedicated prisma role without BYPASSRLS).
-- Application-level authorization still lives in the Next.js API layer.

-- Per-row access model:
--   * Operators (via auth.uid()::text == users.auth_user_id) see only their own rows.
--   * Staff/admin roles read operational data; writes stay in the app layer.
--   * System tables (settings, analytics, RBAC) remain locked down.

SET search_path TO public;

-- ---------------------------------------------------------------------------
-- users / login_attempts / activity_logs -- own-row only
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_user_select" ON "users"
  FOR SELECT USING ("auth_user_id" = auth.uid()::text);

ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_login_attempts_select" ON "login_attempts"
  FOR SELECT USING ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text));

ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_activity_logs_select" ON "activity_logs"
  FOR SELECT USING ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text));

-- ---------------------------------------------------------------------------
-- operator_profiles -- operator sees their own profile, staff list profiles
-- ---------------------------------------------------------------------------
ALTER TABLE "operator_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile_all" ON "operator_profiles"
  USING ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text))
  WITH CHECK ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text));

-- ---------------------------------------------------------------------------
-- toda -- read-only for authenticated users
-- ---------------------------------------------------------------------------
ALTER TABLE "toda" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toda_read_authenticated" ON "toda"
  FOR SELECT USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- franchise_applications + children -- operators reach only their own
-- ---------------------------------------------------------------------------
ALTER TABLE "franchise_applications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_applications_all" ON "franchise_applications"
  USING ("operator_id" IN (
    SELECT "id" FROM "operator_profiles" WHERE "user_id" IN (
      SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text
    )
  ))
  WITH CHECK ("operator_id" IN (
    SELECT "id" FROM "operator_profiles" WHERE "user_id" IN (
      SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text
    )
  ));

ALTER TABLE "application_units" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_units_all" ON "application_units"
  USING ("application_id" IN (SELECT "id" FROM "franchise_applications"))
  WITH CHECK ("application_id" IN (SELECT "id" FROM "franchise_applications"));

ALTER TABLE "application_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_documents_all" ON "application_documents"
  USING ("application_id" IN (SELECT "id" FROM "franchise_applications"))
  WITH CHECK ("application_id" IN (SELECT "id" FROM "franchise_applications"));

ALTER TABLE "application_status_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_status_history_select" ON "application_status_history"
  FOR SELECT USING ("application_id" IN (SELECT "id" FROM "franchise_applications"));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_payments_select" ON "payments"
  FOR SELECT USING ("application_id" IN (SELECT "id" FROM "franchise_applications"));

-- ---------------------------------------------------------------------------
-- franchise_records -- operator reads their own approved records
-- ---------------------------------------------------------------------------
ALTER TABLE "franchise_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_records_select" ON "franchise_records"
  FOR SELECT USING ("operator_id" IN (
    SELECT "id" FROM "operator_profiles" WHERE "user_id" IN (
      SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text
    )
  ));

-- ---------------------------------------------------------------------------
-- notifications -- users read their own inbox
-- ---------------------------------------------------------------------------
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifications_all" ON "notifications"
  FOR ALL USING ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text))
  WITH CHECK ("user_id" IN (SELECT "id" FROM "users" WHERE "auth_user_id" = auth.uid()::text));

-- ---------------------------------------------------------------------------
-- System/admin tables -- no direct client access (app layer only)
-- ---------------------------------------------------------------------------
ALTER TABLE "roles"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_summaries"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_reports"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_exports"           ENABLE ROW LEVEL SECURITY;