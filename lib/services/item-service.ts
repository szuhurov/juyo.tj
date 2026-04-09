import { supabase } from '../supabase';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: 'lost' | 'found';
  location_lat?: number;
  location_lng?: number;
  location_text?: string;
  date: string;
  reward?: string;
  phone_number?: string;
  created_at: string;
  is_resolved: boolean;
  views?: number;
  images?: { image_url: string }[];
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
}

export const CATEGORIES = [
  { id: '1', name: 'Electronics', icon: '📱' },
  { id: '2', name: 'Documents', icon: '📄' },
  { id: '3', name: 'Keys', icon: '🔑' },
  { id: '4', name: 'Clothing', icon: '👕' },
  { id: '5', name: 'Pets', icon: '🐾' },
  { id: '6', name: 'Other', icon: '📦' },
];

export const ItemService = {
  async getItems(filters: { search?: string; category?: string; type?: string | null; user_id?: string } = {}) {
    const { search, category, type, user_id } = filters;
    
    let query = supabase
      .from('items')
      .select('*, images:item_images(image_url)')
      .order('created_at', { ascending: false });

    // If we're looking for a specific user's items, we don't filter by resolved/moderated status
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      query = query.eq('is_resolved', false).eq('moderation_status', 'approved');
    }

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Item[];
  },

  async getItemDetails(id: string) {
    const { data, error } = await supabase
      .from('items')
      .select('*, images:item_images(image_url)')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', data.user_id)
      .single();

    return { ...data, profiles: profile } as Item;
  },

  async incrementView(id: string) {
    const { data, error } = await supabase.rpc('increment_item_views', { item_id: id });
    if (error) {
      // Fallback if RPC doesn't exist yet
      const { data: item } = await supabase.from('items').select('views').eq('id', id).single();
      await supabase.from('items').update({ views: (item?.views || 0) + 1 }).eq('id', id);
    }
  },

  async toggleSaveItem(supabaseClient: any, userId: string, itemId: string) {
    try {
      // Check if already saved
      const { data: existing, error: checkError } = await supabaseClient
        .from('saved_items')
        .select('item_id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Remove if exists
        const { error: deleteError } = await supabaseClient
          .from('saved_items')
          .delete()
          .eq('user_id', userId)
          .eq('item_id', itemId);
        
        if (deleteError) throw deleteError;
        return false; // Successfully unsaved
      } else {
        // Add if not exists
        const { error: insertError } = await supabaseClient
          .from('saved_items')
          .insert([{ user_id: userId, item_id: itemId }]);
        
        if (insertError) throw insertError;
        return true; // Successfully saved
      }
    } catch (error: any) {
      console.error("Detailed error in toggleSaveItem:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
  },

  async getSavedItems(supabaseClient: any, userId: string) {
    const { data, error } = await supabaseClient
      .from('saved_items')
      .select('item_id, items(*, images:item_images(image_url))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map((d: any) => d.items) as Item[];
  },

  // ... other methods will be refactored as needed
};
