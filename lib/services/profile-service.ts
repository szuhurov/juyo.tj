/**
 * Services for working with the user profile (Profile Service).
 * This file performs all operations on the 'profiles' table in Supabase.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Profile data structure
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  // Social networks — optional. Exactly what the user typed is stored
  // (without `@`, without a full link); the link is built for display
  // by `socialHref()`.
  telegram?: string;
  instagram?: string;
  whatsapp?: string;
  facebook?: string;
  /** Short 6-character code for the QR address — see the qr_short_code migration. */
  qr_code?: string;
  is_qr_active?: boolean;
  is_verified?: boolean;
  accepted_terms?: boolean;
  accepted_at?: string;
  terms_version?: string;
  created_at: string;
}

export const ProfileService = {
  // Fetches the current user's profile data
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

  // Updates or creates a new profile (Upsert)
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

  // Fetches the user's public data (visible to others)
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
