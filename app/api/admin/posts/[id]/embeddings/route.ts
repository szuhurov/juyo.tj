import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { VISUAL_MODEL } from "@/lib/visual-model";

/**
 * Admin review: the vectors the ADMIN's browser computed from the published
 * photos (components/admin/posts/post-visual-check.tsx). They replace what
 * the poster's device sent; the response says how close that was.
 * Auth model: admin allowlist (middleware + isAdminUser), 404 otherwise.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    model?: string;
    images?: { image_id?: string; vector?: unknown; phash?: unknown }[];
  } | null;
  if (!body || body.model !== VISUAL_MODEL.id || !Array.isArray(body.images) || body.images.length > 20) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const results: { image_id: string; author_match: number | null }[] = [];
  for (const img of body.images) {
    const ok =
      typeof img.image_id === "string" &&
      Array.isArray(img.vector) &&
      img.vector.length === VISUAL_MODEL.dim &&
      img.vector.every((x) => typeof x === "number" && Number.isFinite(x)) &&
      (img.phash == null || (typeof img.phash === "string" && /^[0-9a-f]{16}$/.test(img.phash)));
    if (!ok) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    // Ownership here is "the photo belongs to this listing" — checked in SQL.
    const { data, error } = await supabaseAdmin.rpc("admin_set_image_embedding", {
      p_image_id: img.image_id,
      p_item_id: id,
      p_model: VISUAL_MODEL.id,
      p_embedding: img.vector,
      p_phash: img.phash ?? null,
    });
    if (error) {
      console.error("POST /api/admin/posts/[id]/embeddings:", error.code);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    results.push({ image_id: img.image_id!, author_match: (data as number | null) ?? null });
  }
  return NextResponse.json({ results });
}
