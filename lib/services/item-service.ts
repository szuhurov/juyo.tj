import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

// Қимати махсуси майдони reward — вақте ки корбар мукофот медиҳад, аммо
// маблағро нишон додан намехоҳад (checkbox фаъол, лекин input холӣ).
export const UNSPECIFIED_REWARD = "unspecified";

// Сохтори маълумотии Ашё (Interface)
export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: "lost" | "found";
  date: string;
  reward?: string;
  phone_number?: string;
  contact_telegram?: boolean;
  contact_whatsapp?: boolean;
  handoff_type?: "self" | "nearby" | null;
  handoff_phone?: string | null;
  handoff_photo_url?: string | null;
  created_at: string;
  is_resolved: boolean;
  views?: number;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_result?: string;
  images?: { image_url: string }[];
  similarity_score?: number;
  location_type?: "taxi" | "hotel_restaurant" | "public_place" | "airport" | null;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
    secondary_phone?: string;
    is_verified?: boolean;
  };
}

// Категорияҳои асосии ашёҳо барои филтр ва ҷустуҷӯ
export const CATEGORIES = [
  { id: "1", name: "Electronics", icon: "📱" },
  { id: "2", name: "Documents", icon: "📄" },
  { id: "3", name: "Keys", icon: "🔑" },
  { id: "4", name: "Clothing", icon: "👕" },
  { id: "5", name: "Pets", icon: "🐾" },
  { id: "6", name: "Other", icon: "📦" },
  { id: "7", name: "LicensePlate", icon: "🚗" },
  { id: "8", name: "Wallet", icon: "👛" },
];

export const ItemService = {
  /**
   * Гирифтани рӯйхати ашёҳо бо истифода аз филтрҳо ва пагинация.
   * Ин функсия имкон медиҳад, ки корбар аз рӯи категория, намуд (гумшуда/ёфтшуда)
   * ва матни ҷустуҷӯӣ эълонҳоро пайдо кунад.
   */
  async getItems(
    filters: {
      search?: string;
      category?: string;
      type?: string | null;
      user_id?: string;
      dateFrom?: string;
      dateTo?: string;
      locationType?: string;
      page?: number;
      pageSize?: number;
    } = {},
    supabaseClient?: SupabaseClient,
  ) {
    const {
      search,
      category,
      type,
      user_id,
      dateFrom,
      dateTo,
      locationType,
      page = 0,
      pageSize = 20,
    } = filters;

    const client = supabaseClient || supabase;

    const s = search
      ? search.trim().slice(0, 200).replace(/[%_\\]/g, "\\$&")
      : undefined;

    // search_items — RPC-и PostgreSQL, ки ҳангоми ҷустуҷӯ натиҷаҳоро аввал
    // аз рӯи мувофиқат (сарлавҳаи айнан баробар > аз он оғоз мешавад >
    // дар бар мегирад > фақат тавсиф), баъд аз рӯи сана sort мекунад —
    // на танҳо аз рӯи сана, чун пештара (ниг. supabase/migrations/20260714000000_search_items_rpc.sql).
    const { data, error } = await client.rpc("search_items", {
      p_search: s || null,
      p_category: category && category !== "All" ? category : null,
      p_type: type || null,
      p_user_id: user_id || null,
      p_limit: pageSize,
      p_offset: page * pageSize,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_location_type: locationType || null,
    });
    if (error) throw error;
    return data as Item[];
  },

  async visualSearch(imageFile: File) {
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("type", "all");

    const { data, error } = await supabase.functions.invoke("visual-search", {
      body: formData,
    });

    if (error) throw error;
    if (!data.results || data.results.length === 0) return [];

    interface VisualSearchResultRow {
      id: string;
      user_id?: string;
      title: string;
      description?: string;
      category?: string;
      type?: string;
      date?: string;
      created_at?: string;
      is_resolved?: boolean;
      score?: number;
      image_url: string;
    }

    // Харитасозии натиҷаҳо ба формати Item
    return data.results.map((res: VisualSearchResultRow) => ({
      id: res.id,
      user_id: res.user_id || "",
      title: res.title,
      description: res.description || "",
      category: res.category || "Other",
      type: (res.type === "found" ? "found" : "lost") as "lost" | "found",
      date: res.date || new Date().toISOString().split("T")[0],
      created_at: res.created_at || new Date().toISOString(),
      is_resolved: res.is_resolved ?? false,
      similarity_score: res.score,
      images: [{ image_url: res.image_url }],
    })) as Item[];
  },

  /**
   * Гирифтани маълумоти муфассали як ашё ва профили соҳиби он.
   *
   * `phone_number` қасдан аз SELECT-и `items` берун аст: пас аз
   * миграцияи 20260824020000 стуни он барои anon/authenticated бо
   * REVOKE пӯшида шудааст (пеш аз он `select=phone_number,user_id` —
   * дархости мустақими PostgREST бо танҳо калиди ошкоро — рақами
   * ТАМОМИ эълонҳои тасдиқшударо дар як дархост медод). Рақам акнун
   * танҳо як-эълон-дар-як-дархост тавассути RPC-и `get_item_phone`
   * гирифта мешавад — ҳамон шарти намоёнӣ, вале bulk-scraping имконнопазир.
   */
  async getItemDetails(id: string, supabaseClient?: SupabaseClient) {
    const client = supabaseClient || supabase;

    // Рӯйхати стунҳо ДАСТӢ аст (на `*`) — маҳз барои берун мондани
    // `phone_number`. Агар сутуни нав ба `items` илова шавад, инро низ
    // навсозӣ кунед.
    const ITEM_COLUMNS =
      "id, user_id, title, description, category, type, date, reward, " +
      "is_resolved, is_guest, views, moderation_status, moderation_result, " +
      "expires_at, created_at, updated_at, status, deleted_at, location_type, " +
      "expiry_notified_at, contact_telegram, contact_whatsapp, " +
      "handoff_type, handoff_photo_url";

    // Query 1: item (бе phone_number/handoff_phone) + аксҳо. Эълони
    // нест-шуда (status = 'deleted') ҳатто барои соҳиби худаш низ "ёфт
    // нашуд" бошад — RLS танҳо соҳибиро месанҷад, on статуси нест-шударо
    // намедонад, бинобар ин филтр ҳамин ҷо лозим аст.
    // Query 2, 3 (параллел): рақамҳо, алоҳида, тавассути RPC (ҳамон
    // ҳимояи як-эълон-дар-як-дархост, ниг. изоҳи боло).
    const [{ data: item, error }, { data: phone }, { data: handoffPhone }] =
      await Promise.all([
        client
          .from("items")
          .select(`${ITEM_COLUMNS}, images:item_images(image_url)`)
          .eq("id", id)
          .or("status.is.null,status.neq.deleted")
          .maybeSingle(),
        client.rpc("get_item_phone", { p_item_id: id }),
        client.rpc("get_item_handoff_phone", { p_item_id: id }),
      ]);

    if (error) throw error;
    if (!item) return null;

    // Query 4: profile аз VIEW ба таври алоҳида (барои пешгирии мушкили FK дар VIEW)
    const { data: profile } = await client
      .from("public_profiles")
      .select("first_name, last_name, avatar_url, is_verified")
      .eq("id", item.user_id)
      .maybeSingle();

    return {
      ...item,
      phone_number: phone ?? undefined,
      handoff_phone: handoffPhone ?? undefined,
      profiles: profile ?? null,
    } as Item;
  },

  async incrementView(id: string) {
    const { error } = await supabase.rpc("increment_item_views", {
      item_id: id,
    });
    if (error) console.error("incrementView:", error.message);
  },

  /**
   * Илова ё нест кардани ашё аз рӯйхати"Захирашудаҳо"(Bookmarks).
   */
  async toggleSaveItem(
    supabaseClient: SupabaseClient,
    userId: string,
    itemId: string,
  ) {
    try {
      // Санҷиши мавҷудияти ашё дар рӯйхати захирашудаҳо
      const { data: existing, error: checkError } = await supabaseClient
        .from("saved_items")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Агар аллакай захира шуда бошад, онро нест мекунем
        const { error: deleteError } = await supabaseClient
          .from("saved_items")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", itemId);

        if (deleteError) throw deleteError;
        return false;
      } else {
        // Агар захира нашуда бошад, илова мекунем
        const { error: insertError } = await supabaseClient
          .from("saved_items")
          .insert([{ user_id: userId, item_id: itemId }]);

        if (insertError) throw insertError;
        return true;
      }
    } catch (error) {
      console.error("Хатогӣ дар toggleSaveItem:", error instanceof Error ? error.message : error);
      throw error;
    }
  },

  /**
   * Гирифтани рӯйхати ашёҳои захиракардаи корбар.
   */
  async getSavedItems(supabaseClient: SupabaseClient, userId: string) {
    const { data, error } = await supabaseClient
      .from("saved_items")
      .select(
        "item_id, items(id, user_id, title, description, category, type, date, reward, created_at, is_resolved, moderation_status, images:item_images(image_url))",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    // Supabase-и бе Database-generated types муносибати items-ро ҳамчун
    // массив тахмин мезанад (гарчанде дар воқеият як-ба-як аст) — d.items
    // санҷиши сахти навъро гирифта наметавонад, аз ин рӯ ба Item мустақим cast мешавад.
    return data.map((d: { items: unknown }) => d.items as Item);
  },

  /**
   * Нест кардани эълон (soft-delete): ашё аз база ва аксҳояш нест намешаванд,
   * танҳо status='deleted' мешавад, то маълумоти вобаста (захирашуда,
   * дархостҳои тасдиқ, таърих) дуруст боқӣ монад ва админ тавонад баркунад.
   */
  async deleteItem(supabaseClient: SupabaseClient, id: string) {
    const { error } = await supabaseClient
      .from("items")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Хатогӣ дар deleteItem:", error);
      throw error;
    }
  },
};
