import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
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
 * Пурра нест кардани ҳисоб — фақат барои профилҳое, ки аллакай дар trash
 * ҳастанд (status='deleted'). Пеш аз нест кардан як snapshot-и пурра
 * (профил + эълонҳо + захирашуда + сандуқча + дархостҳои тасдиқ) захира
 * мешавад, то дар "Пурра нестшуда" click карда шавад ва маълумот дида шавад
 * — на танҳо профил, балки чи корҳое, ки корбар пеш аз нест шудан карда буд.
 * Аввал худи Clerk-ро нест мекунад, баъд тозакунии Supabase-ро (snapshot +
 * cascade hard-delete) ҳамин ҷо мустақим иҷро мекунад — на танҳо ба
 * webhook-и user.deleted такя мекунад, зеро он рӯйдод дар Clerk Dashboard
 * бояд дастӣ фаъол шавад.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!profile) {
      return NextResponse.json({ error: "Корбар ёфт нашуд" }, { status: 404 });
    }
    if (profile.status !== "deleted") {
      return NextResponse.json(
        { error: "Аввал корбарро нест кунед (ба trash гузаронед), баъд пурра нест кунед" },
        { status: 400 },
      );
    }

    const client = await clerkClient();
    try {
      await client.users.deleteUser(id);
    } catch (clerkErr: any) {
      if (clerkErr?.status !== 404) throw clerkErr;
    }

    const [{ data: items }, { data: savedItems }, { data: safetyBoxItems }, { data: verificationAttempts }] = await Promise.all([
      supabaseAdmin.from("items").select(ITEM_FIELDS).eq("user_id", id),
      supabaseAdmin
        .from("saved_items")
        .select(`item_id, created_at, items(${ITEM_FIELDS})`)
        .eq("user_id", id),
      supabaseAdmin
        .from("safety_box")
        .select("id, item_name, description, category, type, reward, images, date, created_at")
        .eq("user_id", id),
      supabaseAdmin
        .from("item_verification_attempts")
        .select("id, item_id, status, created_at, answers, items(title)")
        .eq("claimant_token", id),
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
        user_id: id,
        profile_snapshot: snapshot,
        items_count: (items ?? []).length,
      },
    ]);

    // Ҳар эълони корбар низ алоҳида дар deleted_items_archive сабт мешавад,
    // то саҳифаи Эълонҳо → "Нестшудаҳо" онҳоро низ бинад (на танҳо эълонҳое,
    // ки мустақим нест шудаанд) — ниг. app/api/admin/posts/[id]/permanent-delete.
    if ((items ?? []).length > 0) {
      const ownerName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;
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

    await supabaseAdmin.from("push_tokens").delete().eq("user_id", id);

    const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/admin/users/[id]/permanent-delete:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
