import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

interface ReportItemRow {
  id: string;
  title: string | null;
  moderation_status: string | null;
  images: { image_url: string | null; thumbnail_url: string | null }[] | null;
}

interface ProfileNameRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * User reports (App Store Review 1.2) — migration 20261001000001. Admin-only:
 * middleware gates /api/admin/*, and this handler checks again (404 for
 * non-admins, like every admin route). Reads through the service role; the
 * table has no client read access except a reporter's own rows.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const status = new URL(req.url).searchParams.get("status") ?? "open";

    let query = supabaseAdmin
      .from("content_reports")
      .select("id, reporter_id, item_id, reported_user_id, reason, details, status, admin_note, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("status", status);

    const { data: reports, error } = await query;
    if (error) throw error;

    const itemIds = [...new Set((reports ?? []).map((r) => r.item_id).filter(Boolean))] as string[];
    const userIds = [
      ...new Set((reports ?? []).flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean)),
    ] as string[];

    const [{ data: items }, { data: profiles }] = await Promise.all([
      itemIds.length
        ? supabaseAdmin
            .from("items")
            .select("id, title, moderation_status, images:item_images(image_url, thumbnail_url)")
            .in("id", itemIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const itemById = new Map(((items ?? []) as ReportItemRow[]).map((i) => [i.id, i]));
    const nameById = new Map(
      ((profiles ?? []) as ProfileNameRow[]).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ").trim()]),
    );

    return NextResponse.json({
      reports: (reports ?? []).map((r) => {
        const item = r.item_id ? itemById.get(r.item_id) : undefined;
        const img = item?.images?.[0];
        return {
          ...r,
          reporter_name: nameById.get(r.reporter_id) || null,
          reported_user_name: r.reported_user_id ? nameById.get(r.reported_user_id) || null : null,
          item_title: item?.title ?? null,
          item_status: item?.moderation_status ?? null,
          item_image: img?.thumbnail_url || img?.image_url || null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/admin/reports:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
