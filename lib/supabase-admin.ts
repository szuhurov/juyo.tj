import { createClient, SupabaseClient } from'@supabase/supabase-js';

/**
 * Supabase client with a service-role key — bypasses RLS.
 * Use ONLY in Server Components / Route Handlers, never in "use client".
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
 throw new Error("NEXT_PUBLIC_SUPABASE_URL ва SUPABASE_SERVICE_ROLE_KEY дар .env танзим нашудаанд!");
}

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
 auth: { persistSession: false },
});
