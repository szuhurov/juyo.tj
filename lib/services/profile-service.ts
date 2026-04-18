/**
 * Хизматрасониҳо барои кор бо профили корбар (Profile Service).
 * Ин файл тамоми амалиётҳоро бо ҷадвали 'profiles' дар Supabase иҷро мекунад.
 */

import { createClerkSupabaseClient } from '../supabase'; // Барои пайваст шудан ба база

// Сохтори маълумоти профил
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  phone?: string;
  secondary_phone?: string;
  secondary_phone_type?: string;
  accepted_terms?: boolean;
  accepted_at?: string;
  terms_version?: string;
  created_at: string;
}

export const ProfileService = {
  // Гирифтани маълумоти профили корбари ҷорӣ
  async getProfile(supabaseClient: any, userId: string): Promise<Profile | null> {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Навсозӣ ё сохтани профили нав (Upsert)
  async updateProfile(supabaseClient: any, userId: string, updates: Partial<Profile>) {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .upsert({
          id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase Profile Update Error:", error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Caught Profile Update Error:", err);
      throw err;
    }
  },

  // Гирифтани маълумоти оммавии корбар (барои дигарон намоён)
  async getPublicProfile(supabaseClient: any, userId: string) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, avatar_url, phone, secondary_phone')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }
};
