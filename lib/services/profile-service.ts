import { createClerkSupabaseClient } from '../supabase';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  phone?: string;
  created_at: string;
}

export const ProfileService = {
  async getProfile(supabaseClient: any, userId: string): Promise<Profile | null> {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

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

  async getPublicProfile(supabaseClient: any, userId: string) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, avatar_url, phone')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }
};
