import { supabase } from '../supabase';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: 'lost' | 'found';
  date: string;
  reward?: string;
  phone_number?: string;
  created_at: string;
  is_resolved: boolean;
  views?: number;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  moderation_result?: string;
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
  async getItems(filters: { search?: string; category?: string; type?: string | null; user_id?: string } = {}, supabaseClient?: any) {
    const { search, category, type, user_id } = filters;
    
    const client = supabaseClient || supabase;
    
    let query = client
      .from('items')
      .select('*, images:item_images(image_url)')
      .order('created_at', { ascending: false });

    if (user_id) {
      // If user_id is provided, we ONLY filter by user_id to show all their items
      query = query.eq('user_id', user_id);
    } else {
      // For public view, only show approved and unresolved items
      query = query.or('is_resolved.eq.false,is_resolved.is.null').or('moderation_status.eq.approved,moderation_status.is.null');
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

  async getItemDetails(id: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    const { data, error } = await client
      .from('items')
      .select('*, images:item_images(image_url)')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    const { data: profile } = await client
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

  async getSafetyBoxItems(supabaseClient: any, userId: string) {
    const { data, error } = await supabaseClient
      .from('safety_box')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteItem(supabaseClient: any, id: string) {
    try {
      // 1. Get image records
      const { data: images } = await supabaseClient
        .from('item_images')
        .select('image_url')
        .eq('item_id', id);

      // 2. Delete from storage if images exist
      if (images && images.length > 0) {
        const fileNames = images.map((img: any) => {
          // Robustly extract filename from Supabase URL
          // Format: .../storage/v1/object/public/items/FILENAME
          const urlParts = img.image_url.split('/');
          return urlParts[urlParts.length - 1];
        }).filter(Boolean);

        if (fileNames.length > 0) {
          const { error: storageError } = await supabaseClient.storage
            .from('items')
            .remove(fileNames);
          
          if (storageError) {
            console.error("Storage deletion error:", storageError);
          }
        }
      }

      // 3. Delete the item record
      const { error: deleteError } = await supabaseClient
        .from('items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    } catch (err) {
      console.error("Error in deleteItem:", err);
      throw err;
    }
  },

  async archiveToSafetyBox(supabaseClient: any, item: Item, userId: string) {
    // 1. Insert into safety_box
    const { error: insertError } = await supabaseClient.from('safety_box').insert([{
      user_id: userId,
      item_name: item.title,
      description: item.description,
      category: item.category,
      type: item.type,
      reward: item.reward,
      phone_number: item.phone_number,
      images: item.images?.map(img => img.image_url) || [],
      views: item.views || 0,
      date: item.date, // Preserve the item's original date
      created_at: item.created_at
    }]);

    if (insertError) throw insertError;

    // 2. Delete from items
    const { error: deleteError } = await supabaseClient.from('items').delete().eq('id', item.id);
    if (deleteError) throw deleteError;
  },

  async publishFromSafetyBox(supabaseClient: any, safetyItem: any, userId: string) {
    // 1. Create item in feed
    const { data: item, error: itemError } = await supabaseClient
      .from('items')
      .insert([{
        user_id: userId,
        title: safetyItem.item_name,
        description: safetyItem.description,
        category: safetyItem.category,
        type: safetyItem.type || 'lost',
        date: safetyItem.date || new Date().toISOString().split('T')[0],
        reward: safetyItem.reward,
        phone_number: safetyItem.phone_number,
        is_resolved: false,
        views: safetyItem.views || 0, // Carry over views
        created_at: safetyItem.created_at, // Preserve original creation date
        moderation_status: 'pending'
      }])
      .select()
      .single();

    if (itemError) throw itemError;

    // 2. Add images
    if (safetyItem.images?.length > 0) {
      const imageRecords = safetyItem.images.map((url: string) => ({
        item_id: item.id,
        image_url: url
      }));
      await supabaseClient.from('item_images').insert(imageRecords);
    }

    // 3. Remove from safety box
    const { error: deleteError } = await supabaseClient.from('safety_box').delete().eq('id', safetyItem.id);
    if (deleteError) throw deleteError;

    return item;
  }
};
