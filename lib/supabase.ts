/**
 * Инҷо пайваст шудан ба Supabase-ро танзим мекунем.
 * Ин файл барои он лозим аст, ки барнома бо базаи маълумот гап занад.
 */
import { createClient } from '@supabase/supabase-js'; // Барои пайваст шудан ба базаи Supabase

// URL ва калиди Supabase-ро аз файлҳои .env мегирем
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Агар калидҳо набошанд, дар консол огоҳӣ медиҳем, ки кор намекунад
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Настройкаҳои Supabase нест! Файли .env-ро санҷед.");
}

/**
 * Муштарии оддӣ (client) барои корҳои умумӣ.
 * Ин барои гирифтани маълумотҳое, ки ҳама мебинанд (бе регистратсия).
 */
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

/**
 * Ин функсия барои сохтани пайвасти махсус бо токени Clerk лозим аст.
 * Вақте корбар дар сайт "логин" мекунад, мо токени ӯро ба Supabase мефиристем.
 * Ин кор барои амният (RLS) лозим аст, то касе ба маълумоти каси дигар даст нарасонад.
 */
export const createClerkSupabaseClient = (clerkToken: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Настройкаҳои Supabase ёфт нашуд!");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        // Токени корбарро ба "header" илова мекунем
        Authorization: `Bearer ${clerkToken}`,
      },
    },
  });
};
