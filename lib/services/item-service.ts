import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

// Special value for the reward field — used when the user offers a reward
// but doesn't want to show the amount (checkbox checked, but input empty).
export const UNSPECIFIED_REWARD = "unspecified";

// Data structure for an Item (Interface)
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
  location_type?: "taxi" | "hotel_restaurant" | "public_place" | "airport" | "gym" | null;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
    secondary_phone?: string;
    is_verified?: boolean;
  };
}

// Main item categories for filtering and search
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
   * Fetches the list of items using filters and pagination.
   * This function lets the user find listings by category, type (lost/found),
   * and search text.
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

    // search_items — a PostgreSQL RPC that, when searching, sorts results
    // first by relevance (exact title match > starts with it >
    // contains it > description only), then by date —
    // not just by date as before (see supabase/migrations/20260714000000_search_items_rpc.sql).
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

    // The edge function (supabase/functions/visual-search) already returns
    // FULL `items` rows (with `images:item_images(image_url)` and
    // `similarity_score`) — exactly in `Item` shape. Re-mapping here is
    // not needed — it used to be done this way, and it replaced these
    // already-correct fields with the old flat shape (`image_url`/`score`),
    // which no longer exist — the result came out without images and
    // without a match percentage.
    return (data.results ?? []) as Item[];
  },

  /**
   * Fetches detailed information about a single item and its owner's profile.
   *
   * `phone_number` is deliberately excluded from the `items` SELECT: after
   * migration 20260824020000 its column is closed off for anon/authenticated
   * via REVOKE (before that, `select=phone_number,user_id` — a direct
   * PostgREST request with just the public key — would return the phone
   * number of ALL approved listings in a single request). The number is now
   * fetched only one-listing-per-request via the `get_item_phone` RPC —
   * the same visibility rule, but bulk-scraping is no longer possible.
   */
  async getItemDetails(id: string, supabaseClient?: SupabaseClient) {
    const client = supabaseClient || supabase;

    // The column list is MANUAL (not `*`) — specifically to leave out
    // `phone_number`. If a new column is added to `items`, update this
    // list too.
    const ITEM_COLUMNS =
      "id, user_id, title, description, category, type, date, reward, " +
      "is_resolved, is_guest, views, moderation_status, moderation_result, " +
      "expires_at, created_at, updated_at, status, deleted_at, location_type, " +
      "expiry_notified_at, contact_telegram, contact_whatsapp, " +
      "handoff_type, handoff_photo_url";

    // Query 1: the item (without phone_number/handoff_phone) + images. A
    // deleted listing (status = 'deleted') should read as "not found" even
    // for its own owner — RLS only checks ownership, it doesn't know about
    // the deleted status, so the filter is needed here too.
    // Query 2, 3 (in parallel): phone numbers, fetched separately via RPC
    // (the same one-listing-per-request protection, see the comment above).
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

    // Query 4: the profile from a VIEW, fetched separately (to avoid an FK issue in the VIEW)
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
   * Adds or removes an item from the "Saved" list (Bookmarks).
   */
  async toggleSaveItem(
    supabaseClient: SupabaseClient,
    userId: string,
    itemId: string,
  ) {
    try {
      // Check whether the item already exists in the saved list
      const { data: existing, error: checkError } = await supabaseClient
        .from("saved_items")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // If it's already saved, remove it
        const { error: deleteError } = await supabaseClient
          .from("saved_items")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", itemId);

        if (deleteError) throw deleteError;
        return false;
      } else {
        // If it's not saved, add it
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
   * Fetches the list of items the user has saved.
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
    // Supabase without Database-generated types assumes the items relation
    // is an array (even though it's actually one-to-one) — d.items
    // can't pass strict type checking, so it's cast directly to Item.
    return data.map((d: { items: unknown }) => d.items as Item);
  },

  /**
   * Deletes a listing (soft-delete): the item and its images are not
   * removed from the database, only status='deleted' is set, so that
   * related data (saves, confirmation requests, history) stays intact and
   * an admin can restore it.
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
