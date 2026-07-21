import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ва NEXT_PUBLIC_SUPABASE_ANON_KEY дар .env танзим нашудаанд!"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Ҳар токен як GoTrueClient месозад (Supabase дар console огоҳӣ медиҳад,
// агар якчанд instance якбора барои ҳамон storage key кор кунанд). Токени
// Clerk дар доираи муддати эътиборинокиаш (~1 дақ) якхела мемонад — пас
// кэш кардан аз рӯи худи токен GoTrueClient-ҳои такрории беneed-ро пешгирӣ
// мекунад (масалан poll-ҳои 20-сонияи useNotifications).
const clientCache = new Map<string, SupabaseClient>();
const MAX_CACHED_CLIENTS = 5;

export const createClerkSupabaseClient = (clerkToken: string): SupabaseClient => {
  const cached = clientCache.get(clerkToken);
  if (cached) return cached;

  if (clientCache.size >= MAX_CACHED_CLIENTS) clientCache.clear();

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${clerkToken}` } },
  });
  clientCache.set(clerkToken, client);
  return client;
};
