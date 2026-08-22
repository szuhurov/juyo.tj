/**
 * Хизматрасониҳо барои кор бо профили корбар (Profile Service).
 * Ин файл тамоми амалиётҳоро бо ҷадвали'profiles'дар Supabase иҷро мекунад.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Сохтори маълумоти профил
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  // Шабакаҳои иҷтимоӣ — ихтиёрӣ. Ҳамон чизе ки корбар навиштааст нигоҳ
  // дошта мешавад (бе `@`, бе пайванди пурра); пайванд ҳангоми нишон
  // додан аз `socialHref()` сохта мешавад.
  telegram?: string;
  instagram?: string;
  whatsapp?: string;
  facebook?: string;
  /** Рамзи кӯтоҳи 6-ҳарфа барои суроғаи QR — ниг. миграцияи qr_short_code. */
  qr_code?: string;
  is_qr_active?: boolean;
  is_verified?: boolean;
  accepted_terms?: boolean;
  accepted_at?: string;
  terms_version?: string;
  created_at: string;
}

export const ProfileService = {
  // Гирифтани маълумоти профили корбари ҷорӣ
  async getProfile(
    supabaseClient: SupabaseClient,
    userId: string,
  ): Promise<Profile | null> {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Навсозӣ ё сохтани профили нав (Upsert)
  async updateProfile(
    supabaseClient: SupabaseClient,
    userId: string,
    updates: Partial<Profile>,
  ) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .upsert({
          id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      if (updates.is_qr_active === true) {
        const { error: rpcError } = await supabaseClient.rpc("increment_qr_activation_count", { p_user_id: userId });
        if (rpcError) console.error("increment_qr_activation_count:", rpcError.message);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Гирифтани маълумоти оммавии корбар (барои дигарон намоён)
  async getPublicProfile(supabaseClient: SupabaseClient, userId: string) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select(
        "first_name, last_name, avatar_url, phone, secondary_phone, is_qr_active",
      )
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  },
};
