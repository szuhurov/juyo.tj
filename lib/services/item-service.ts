import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Сохтори маълумотии Ашё (Interface)
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
  is_guest?: boolean;
  expires_at?: string;
  images?: { image_url: string }[];
  similarity_score?: number;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
    secondary_phone?: string;
  };
}

export interface SafetyItem {
  id: string;
  user_id: string;
  item_name: string;
  description?: string;
  category?: string;
  type: 'lost' | 'found';
  reward?: string;
  phone_number?: string;
  images?: string[];
  views?: number;
  date?: string;
  created_at: string;
}

// Категорияҳои асосии ашёҳо барои филтр ва ҷустуҷӯ
export const CATEGORIES = [
  { id: '1', name: 'Electronics', icon: '📱' },
  { id: '2', name: 'Documents', icon: '📄' },
  { id: '3', name: 'Keys', icon: '🔑' },
  { id: '4', name: 'Clothing', icon: '👕' },
  { id: '5', name: 'Pets', icon: '🐾' },
  { id: '6', name: 'Other', icon: '📦' },
];

export const ItemService = {
  /**
   * Гирифтани рӯйхати ашёҳо бо истифода аз филтрҳо ва пагинация.
   * Ин функсия имкон медиҳад, ки корбар аз рӯи категория, намуд (гумшуда/ёфтшуда)
   * ва матни ҷустуҷӯӣ эълонҳоро пайдо кунад.
   */
  async getItems(filters: { search?: string; category?: string; type?: string | null; user_id?: string; page?: number; pageSize?: number } = {}, supabaseClient?: SupabaseClient) {
    const { search, category, type, user_id, page = 0, pageSize = 20 } = filters;
    
    const client = supabaseClient || supabase;
    
    let query = client
      .from('items')
      .select('id, user_id, title, description, category, type, date, reward, created_at, is_resolved, moderation_status, images:item_images(image_url)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Пагинация (боркунии қисм-қисм)
    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      query = query
        .eq('moderation_status', 'approved')
        .or('is_resolved.eq.false,is_resolved.is.null');
    }

    // Филтр аз рӯи категория
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    // Филтр аз рӯи намуд (lost/found)
    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      const s = search.trim().slice(0, 200).replace(/[%_\\]/g, '\\$&');
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Item[];
  },

  async visualSearch(imageFile: File) {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('type', 'all');

    const { data, error } = await supabase.functions.invoke('visual-search', {
      body: formData
    });

    if (error) throw error;
    if (!data.results || data.results.length === 0) return [];

    // Харитасозии натиҷаҳо ба формати Item
    return data.results.map((res: any) => ({
      id: res.id,
      user_id: res.user_id || '',
      title: res.title,
      description: res.description || '',
      category: res.category || 'Other',
      type: (res.type === 'found' ? 'found' : 'lost') as 'lost' | 'found',
      date: res.date || new Date().toISOString().split('T')[0],
      created_at: res.created_at || new Date().toISOString(),
      is_resolved: res.is_resolved ?? false,
      similarity_score: res.score,
      images: [{ image_url: res.image_url }]
    })) as Item[];
  },

  /**
   * Гирифтани маълумоти муфассали як ашё ва профили соҳиби он.
   */
  async getItemDetails(id: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;

    // Query 1: item + images (FK-и мустақим мавҷуд аст, эмбед кор мекунад)
    const { data: item, error } = await client
      .from('items')
      .select('*, images:item_images(image_url)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!item) return null;

    // Query 2: profile аз VIEW ба таври алоҳида (барои пешгирии мушкили FK дар VIEW)
    const { data: profile } = await client
      .from('public_profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', item.user_id)
      .maybeSingle();

    return { ...item, profiles: profile ?? null } as Item;
  },

  async incrementView(id: string) {
    const { error } = await supabase.rpc('increment_item_views', { item_id: id });
    if (error) console.error('incrementView:', error.message);
  },

  /**
   * Илова ё нест кардани ашё аз рӯйхати "Захирашудаҳо" (Bookmarks).
   */
  async toggleSaveItem(supabaseClient: SupabaseClient, userId: string, itemId: string) {
    try {
      // Санҷиши мавҷудияти ашё дар рӯйхати захирашудаҳо
      const { data: existing, error: checkError } = await supabaseClient
        .from('saved_items')
        .select('item_id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Агар аллакай захира шуда бошад, онро нест мекунем
        const { error: deleteError } = await supabaseClient
          .from('saved_items')
          .delete()
          .eq('user_id', userId)
          .eq('item_id', itemId);
        
        if (deleteError) throw deleteError;
        return false; 
      } else {
        // Агар захира нашуда бошад, илова мекунем
        const { error: insertError } = await supabaseClient
          .from('saved_items')
          .insert([{ user_id: userId, item_id: itemId }]);
        
        if (insertError) throw insertError;
        return true;
      }
    } catch (error: any) {
      console.error("Хатогӣ дар toggleSaveItem:", error.message);
      throw error;
    }
  },

  /**
   * Гирифтани рӯйхати ашёҳои захиракардаи корбар.
   */
  async getSavedItems(supabaseClient: SupabaseClient, userId: string) {
    const { data, error } = await supabaseClient
      .from('saved_items')
      .select('item_id, items(id, user_id, title, description, category, type, date, reward, created_at, is_resolved, moderation_status, images:item_images(image_url))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map((d: any) => d.items) as Item[];
  },

  /**
   * Гирифтани ашёҳо аз "Сандуқчаи бехатарӣ" (Safety Box).
   */
  async getSafetyBoxItems(supabaseClient: SupabaseClient, userId: string) {
    const { data, error } = await supabaseClient
      .from('safety_box')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Гирифтани маълумоти муфассали як ашё аз "Сандуқчаи бехатарӣ".
   */
  async getSafetyItemDetails(id: string, supabaseClient: SupabaseClient) {
    const { data, error } = await supabaseClient
      .from('safety_box')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Нест кардани эълон ва аксҳои он аз база ва аз Storage.
   */
  async deleteItem(supabaseClient: SupabaseClient, id: string) {
    try {
      // 1. Гирифтани рӯйхати аксҳо пеш аз нест кардани эълон
      const { data: images, error: imagesError } = await supabaseClient
        .from('item_images')
        .select('image_url')
        .eq('item_id', id);

      if (imagesError) console.error("Хатогӣ ҳангоми гирифтани аксҳо:", imagesError);

      // 2. Тоза кардани файлҳо аз Storage (Object Storage)
      if (images && images.length > 0) {
        const filePaths = images.map((img: any) => {
          try {
            const url = new URL(img.image_url);
            const pathParts = url.pathname.split('/public/items/');
            return pathParts.length > 1 ? pathParts[1] : null;
          } catch (e) {
            const parts = img.image_url.split('/public/items/');
            return parts.length > 1 ? parts[1].split('?')[0] : null;
          }
        }).filter(Boolean);

        if (filePaths.length > 0) {
          await supabaseClient.storage.from('items').remove(filePaths);
        }
      }

      // 3. Нест кардани худи эълон (item_images ба таври CASCADE нест мешаванд)
      const { error: deleteError } = await supabaseClient
        .from('items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    } catch (err) {
      console.error("Хатогӣ дар deleteItem:", err);
      throw err;
    }
  },

  /**
   * Интиқоли эълон аз лентаи умумӣ ба "Сандуқчаи бехатарӣ" (Архив).
   */
  async archiveToSafetyBox(supabaseClient: SupabaseClient, item: Item, userId: string) {
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
      date: item.date,
      text_moderated: true,
      images_moderated: true,
      created_at: item.created_at
    }]);

    if (insertError) throw insertError;

    // Нест кардан аз лентаи умумӣ
    const { error: deleteError } = await supabaseClient.from('items').delete().eq('id', item.id);
    if (deleteError) throw deleteError;
  },

  /**
   * Нашри эълон аз "Сандуқчаи бехатарӣ" ба лентаи умумӣ.
   */
  async publishFromSafetyBox(supabaseClient: SupabaseClient, safetyItem: SafetyItem, userId: string, status: 'pending' | 'approved' = 'pending') {
    // 1. Сохтани эълони нав дар ҷадвали 'items'
    const { data: item, error: itemError } = await supabaseClient
      .from('items')
      .insert([{
        user_id: userId,
        title: safetyItem.item_name,
        description: safetyItem.description,
        category: safetyItem.category,
        type: safetyItem.type || 'lost',
        date: new Date().toISOString().split('T')[0],
        reward: safetyItem.reward,
        phone_number: safetyItem.phone_number,
        is_resolved: false,
        views: 0,
        created_at: new Date().toISOString(),
        moderation_status: status
      }])
      .select()
      .single();

    if (itemError) throw itemError;

    // 2. Илова кардани аксҳо ба ҷадвали 'item_images'
    if ((safetyItem.images?.length ?? 0) > 0) {
      const imageRecords = safetyItem.images!.map((url: string) => ({
        item_id: item.id,
        image_url: url
      }));
      await supabaseClient.from('item_images').insert(imageRecords);
    }

    // 3. Нест кардан аз "Сандуқчаи бехатарӣ"
    const { error: deleteError } = await supabaseClient.from('safety_box').delete().eq('id', safetyItem.id);
    if (deleteError) throw deleteError;

    return item;
  }
};
