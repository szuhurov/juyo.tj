/**
 * Хизматрасонӣ барои маълумоти оммавии саҳифаи асосӣ (Landing stats).
 * Танҳо рақамҳо ва аватарҳои воқеии корбарон аз ҷадвали'profiles'гирифта мешаванд.
 */

import { SupabaseClient } from'@supabase/supabase-js';

export interface LandingStats {
 userCount: number;
 avatars: string[];
}

export const StatsService = {
 async getLandingStats(client: SupabaseClient): Promise<LandingStats> {
 const [{ count }, { data: avatarRows }] = await Promise.all([
 client.from('profiles').select('id', { count:'exact', head: true }),
 client
 .from('profiles')
 .select('avatar_url')
 .not('avatar_url','is', null)
 .order('created_at', { ascending: false })
 .limit(4),
 ]);

 return {
 userCount: count ?? 0,
 avatars: (avatarRows ?? [])
 .map((r: { avatar_url: string | null }) => r.avatar_url)
 .filter((url: string | null): url is string => !!url),
 };
 },
};
