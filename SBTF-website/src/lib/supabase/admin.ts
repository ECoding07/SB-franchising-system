import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Server-side only — never import this into a
 * Client Component. Used for privileged storage operations (signed URLs).
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
