import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Ёфтани ҳамаи постҳои гузашта
    const { data: expiredItems, error: fetchError } = await supabase
      .from("items")
      .select("id")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;
    if (!expiredItems || expiredItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deleted: 0, message: "No expired posts found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemIds = expiredItems.map((i: any) => i.id);
    let deletedCount = 0;
    let storageErrors = 0;

    for (const itemId of itemIds) {
      // 2. Гирифтани рӯйхати аксҳо
      const { data: images } = await supabase
        .from("item_images")
        .select("image_url")
        .eq("item_id", itemId);

      // 3. Нест кардани аксҳо аз Storage
      if (images && images.length > 0) {
        const filePaths = images
          .map((img: any) => {
            try {
              const url = new URL(img.image_url);
              const parts = url.pathname.split("/public/items/");
              return parts.length > 1 ? parts[1] : null;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("items")
            .remove(filePaths);

          if (storageError) {
            console.error(`Storage error for item ${itemId}:`, storageError.message);
            storageErrors++;
          }
        }
      }

      // 4. Нест кардани пост аз база (item_images CASCADE нест мешавад)
      const { error: deleteError } = await supabase
        .from("items")
        .delete()
        .eq("id", itemId);

      if (deleteError) {
        console.error(`Delete error for item ${itemId}:`, deleteError.message);
      } else {
        deletedCount++;
      }
    }

    console.log(`Cleanup done: ${deletedCount} items deleted, ${storageErrors} storage errors`);

    return new Response(
      JSON.stringify({ success: true, deleted: deletedCount, storageErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cleanup function error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
