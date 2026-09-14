import { supabaseAdmin } from "@/lib/supabase-admin";

function extractStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const parts = new URL(imageUrl).pathname.split("/public/items/");
    return parts.length > 1 ? parts[1] : null;
  } catch {
    const parts = imageUrl.split("/public/items/");
    return parts.length > 1 ? parts[1].split("?")[0] : null;
  }
}

const ITEM_FIELDS = "*, images:item_images(image_url)";

/**
 * Actually deletes the listing (by the owner themselves) — as opposed to
 * ItemService.deleteItem (soft-delete, status='deleted'), which is used
 * both for "Delete" and for "Resolved". This function is only for the
 * real "Delete" action: a snapshot is saved to deleted_items_archive,
 * the images are removed from storage, then the row is fully deleted from
 * items (CASCADE item_images/saved_items). We nullify the
 * external_items.published_item_id FK before this (it's ON DELETE NO
 * ACTION, otherwise it would raise an FK violation for imported listings).
 */
export async function hardDeleteItem(
  itemId: string,
  requesterUserId: string,
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const { data: item, error } = await supabaseAdmin
    .from("items")
    .select(ITEM_FIELDS)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!item) return { ok: false, status: 404, reason: "Эълон ёфт нашуд" };
  if (item.user_id !== requesterUserId) return { ok: false, status: 403, reason: "Шумо соҳиби ин эълон нестед" };

  await supabaseAdmin.from("deleted_items_archive").insert([{ item_id: itemId, item_snapshot: item }]);

  await supabaseAdmin.from("external_items").update({ published_item_id: null }).eq("published_item_id", itemId);

  const itemImages = (item as { images?: { image_url: string }[] }).images ?? [];
  const storagePaths = itemImages
    .map((img) => extractStoragePath(img.image_url))
    .filter((p): p is string => !!p);
  if (storagePaths.length > 0) {
    await supabaseAdmin.storage.from("items").remove(storagePaths);
  }

  const { error: deleteError } = await supabaseAdmin.from("items").delete().eq("id", itemId);
  if (deleteError) throw deleteError;

  return { ok: true };
}
