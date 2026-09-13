import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ва NEXT_PUBLIC_SUPABASE_ANON_KEY дар .env танзим нашудаанд!"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Пештар ин ҷо ҳар дархост клиенти НАВ бо `global.headers.Authorization`
// (header-и дастӣ) месохт. Ин усули КӮҲНА буд — Supabase онро ҳамчун
// header-и оддӣ мегирад, на ҳамчун токени Third-Party Auth, пас баъзе
// хизматҳо (масалан Storage) кӯшиш мекарданд онро бо масири кӯҳнаи
// HS256 тасдиқ кунанд ва бо хатои "Key for RS256 algorithm must be
// CryptoKey... received Uint8Array" меафтоданд — токен RS256 буд (Clerk),
// вале тасдиқ бо сирри кӯҳна (Uint8Array) кӯшиш мешуд.
//
// ХАЛ (ҳамон намунае, ки барномаи мобилӣ аллакай истифода мебарад — ниг.
// https://supabase.com/docs/guides/auth/third-party/clerk): опсияи
// расмии `accessToken` supabase-js-ро — вай ин callback-ро ДАР ҲАР
// дархост худаш дубора даъват мекунад, пас (1) template/header-и дастӣ
// лозим нест, (2) 60-сонияи lifetime-и токен масъала намешавад (ҳамеша
// тоза гирифта мешавад), (3) ба ҷои як client барои ҳар токен, ҳамагӣ
// ЯК client барои тамоми сессия кофист.
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
