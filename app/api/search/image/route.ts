import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { VISUAL_MODEL } from "@/lib/visual-model";

/**
 * Search by photo (web and mobile). Public like text search. The caller
 * sends only the vector its own device computed from the photo, plus a
 * 64-bit pHash — never the photo (lib/visual-search.ts,
 * app/lib/visual-search.ts). No AI runs on any server.
 *
 * Auth model: public, abuse-limited twice — per IP in middleware (in-memory,
 * per instance) and per hashed IP in the database (search_visual, 30 per 10
 * minutes, shared by all instances). search_visual is service-role only, so
 * the vector table can never be queried directly with the public anon key.
 * Returns approved, unresolved listings (the public browsing rule) with a
 * relevance tier — never a vector, never a phone number.
 */
const MAX_BODY = 32 * 1024;

const PUBLIC_FIELDS =
  "id, title, description, category, type, city, date, reward, created_at, location_type, images:item_images(image_url, thumbnail_url)";

function clientHash(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  // The raw IP is never stored: only this daily-rotating keyed hash.
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${day}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
}

function parse(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.model !== VISUAL_MODEL.id) return null;
  if (!Array.isArray(b.vector) || b.vector.length !== VISUAL_MODEL.dim) return null;
  if (!b.vector.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  const phash = typeof b.phash === "string" && /^[0-9a-f]{16}$/.test(b.phash) ? b.phash : null;
  const filter = (k: string) => {
    const v = b[k];
    return typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : null;
  };
  return {
    vector: b.vector as number[],
    phash,
    // hard filters
    type: filter("type"),
    category: filter("category"),
    city: filter("city"),
    // ranking preferences (the searcher's own city / category): small bounded bonus
    preferCategory: filter("prefer_category"),
    preferCity: filter("prefer_city"),
  };
}

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let input: ReturnType<typeof parse> = null;
  try {
    input = parse(JSON.parse(text));
  } catch {
    input = null;
  }
  // An old app build that still posts image bytes, or another model version.
  if (!input) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: hits, error } = await supabaseAdmin.rpc("search_visual", {
    p_model: VISUAL_MODEL.id,
    p_embedding: input.vector,
    p_phash: input.phash,
    p_client_hash: clientHash(req),
    p_type: input.type,
    p_category: input.category,
    p_city: input.city,
    p_prefer_category: input.preferCategory,
    p_prefer_city: input.preferCity,
    p_limit: 30,
  });
  if (error) {
    if (error.message?.includes("rate_limited")) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (error.message?.includes("bad_vector")) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    console.error("POST /api/search/image: search_visual", error.code);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const results = (hits ?? []) as { item_id: string; score: number; tier: string }[];
  if (!results.length) return NextResponse.json({ items: [] });

  // search_visual already applies the public browsing rule; it is applied
  // again here because this client bypasses RLS.
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("items")
    .select(PUBLIC_FIELDS)
    .in("id", results.map((r) => r.item_id))
    .eq("moderation_status", "approved")
    .or("is_resolved.is.null,is_resolved.eq.false")
    .or("status.is.null,status.neq.deleted");
  if (itemsError) {
    console.error("POST /api/search/image: items", itemsError.code);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  return NextResponse.json({
    items: results
      .filter((r) => byId.has(r.item_id))
      .map((r) => ({
        ...byId.get(r.item_id)!,
        visual: { score: Math.round(r.score * 1000) / 1000, reasons: [r.tier] },
      })),
  });
}

