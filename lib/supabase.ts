import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ва NEXT_PUBLIC_SUPABASE_ANON_KEY дар .env танзим нашудаанд!"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// This used to build a NEW client on every request here with
// `global.headers.Authorization` (a manual header). That approach was
// OUTDATED — Supabase treats it as a plain header, not as a Third-Party
// Auth token, so some services (e.g. Storage) would try to verify it via
// the old HS256 path and fail with "Key for RS256 algorithm must be
// CryptoKey... received Uint8Array" — the token was RS256 (Clerk), but
// verification was attempted with the old secret (Uint8Array).
//
// FIX (the same pattern the mobile app already uses — see
// https://supabase.com/docs/guides/auth/third-party/clerk): supabase-js's
// official `accessToken` option — it calls this callback again ITSELF on
// EVERY request, so (1) a manual template/header is not needed, (2) the
// token's 60-second lifetime is not an issue (a fresh one is always
// fetched), (3) instead of one client per token, just ONE client for the
// whole session is enough.
let cachedClerkGetToken: (() => Promise<string | null>) | null = null;
let authedClient: SupabaseClient | null = null;

export function createClerkSupabaseClient(
  clerkGetToken: () => Promise<string | null>,
): SupabaseClient {
  cachedClerkGetToken = clerkGetToken;
  if (!authedClient) {
    authedClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      accessToken: () => cachedClerkGetToken!(),
    });
  }
  return authedClient;
}
