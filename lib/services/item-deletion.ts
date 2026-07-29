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
 * Нест кардани воқеии эълон (аз ҷониби худи соҳиб) — бар хилофи
 * ItemService.deleteItem (soft-delete, status='deleted'), ки ҳам барои
 * "Нест кардан" ва ҳам барои "Ҳал шуд" истифода мешавад. Ин функсия танҳо
 * барои амали "Нест кардан"-и воқеӣ аст: snapshot дар deleted_items_archive,
 * аксҳо аз storage, баъд сатр аз items пурра нест мешавад (CASCADE
 * item_images/saved_items/item_reports). external_items.published_item_id
 * пеш аз ин FK-ро nullify мекунем (ON DELETE NO ACTION аст, вагарна FK
 * violation медиҳад барои элонҳои воридотӣ).
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
