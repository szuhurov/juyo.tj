import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

const ITEM_FIELDS = "id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url)";

/**
 * Худи корбар ҳисоби худро нест мекунад (Танзимот → "Нест кардани ҳисоб").
 * Тозакунии Supabase-ро мустақим ҳамин ҷо иҷро мекунад — на танҳо ба
 * webhook-и user.deleted такя мекунад (ки дар Clerk Dashboard бояд дастӣ
 * фаъол шавад ва метавонад ноком шавад). Клиент ин route-ро ПЕШ АЗ
 * user.delete()-и Clerk мезанад, то сессия то охир эътибор дошта бошад.
 * Ҳамон snapshot+cascade-delete-и "Пурра нест кардан"-и admin такрор
 * мешавад, то дар архиви admin низ дида шавад.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!profile) {
      return NextResponse.json({ ok: true });
    }

    const [{ data: items }, { data: savedItems }, { data: safetyBoxItems }, { data: verificationAttempts }] = await Promise.all([
      supabaseAdmin.from("items").select(ITEM_FIELDS).eq("user_id", userId),
      supabaseAdmin
        .from("saved_items")
        .select(`item_id, created_at, items(${ITEM_FIELDS})`)
        .eq("user_id", userId),
      supabaseAdmin
        .from("safety_box")
        .select("id, item_name, description, category, type, reward, images, date, created_at")
        .eq("user_id", userId),
      supabaseAdmin
        .from("item_verification_attempts")
        .select("id, item_id, status, created_at, answers, items(title)")
        .eq("claimant_token", userId),
    ]);

    const snapshot = {
      profile,
      items: items ?? [],
      savedItems: savedItems ?? [],
      safetyBoxItems: safetyBoxItems ?? [],
      verificationAttempts: verificationAttempts ?? [],
    };

    await supabaseAdmin.from("deleted_accounts_archive").insert([
      {
        user_id: userId,
        profile_snapshot: snapshot,
        items_count: (items ?? []).length,
      },
    ]);

    if ((items ?? []).length > 0) {
      await supabaseAdmin.from("deleted_items_archive").insert(
        (items ?? []).map((item) => ({
          item_id: item.id,
          item_snapshot: { ...item, profiles: { first_name: profile.first_name, last_name: profile.last_name } },
        })),
      );
    }

    const storagePaths: string[] = [];
    for (const item of items ?? []) {
      for (const img of (item as any).images ?? []) {
        const path = extractStoragePath(img.image_url);
        if (path) storagePaths.push(path);
      }
    }
    const avatarPath = extractStoragePath(profile.avatar_url);
    if (avatarPath) storagePaths.push(avatarPath);
    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from("items").remove(storagePaths);
    }

    await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);

    const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/account/delete:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
