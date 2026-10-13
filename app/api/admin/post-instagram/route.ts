/**
 * Admin only: publish a listing for a person who wrote to JUYO on Instagram.
 * The admin is the reviewer, so the listing is approved at once.
 *
 * Auth model: admin allowlist (middleware + isAdminUser), 404 otherwise.
 * Photos are uploaded by the admin's browser first (re-encoded there, so no
 * EXIF/GPS); this route only accepts URLs of the `items` bucket or the JUYO
 * placeholder. Documents/Cards never carry a photo — same rule as the public
 * form, and the database enforces it too.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CATEGORIES, UNSPECIFIED_REWARD } from "@/lib/services/item-service";
import { CITY_IDS } from "@/lib/cities";
import { isNoPhotoCategory, isPlaceholderUrl, placeholderImageUrl } from "@/lib/photo-policy";
import { maskSensitiveNumbers } from "@/lib/sensitive-text";
import { INSTAGRAM_AVATAR_URL, INSTAGRAM_PROFILE_NAME, INSTAGRAM_PROFILE_PREFIX } from "@/lib/instagram-source";
import { insertItemWithSource } from "@/lib/client-stats";

const LOCATION_TYPES = [
  "taxi", "hotel_restaurant", "public_place", "airport", "gym",
  "university", "mall", "office", "tourism", "bank",
];
const MAX_PHOTOS = 4;
const BUCKET_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/items/`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(req: NextRequest) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Дархост нодуруст аст");

  const firstName = text(body.first_name, 40);
  const lastName = text(body.last_name, 40);
  const phone = text(body.phone, 20).replace(/[^0-9+]/g, "");
  const title = text(body.title, 120);
  const description = text(body.description, 2000);
  const category = text(body.category, 40);
  const type = body.type === "found" ? "found" : body.type === "lost" ? "lost" : null;
  const city = text(body.city, 40);
  const locationType = text(body.location_type, 40) || null;
  const date = text(body.date, 10);
  const reward = text(body.reward, 12);

  if (!firstName || !lastName) return bad("Ном ва насаби шахсро нависед");
  if (phone.replace(/\D/g, "").length < 7) return bad("Рақами телефон нодуруст аст");
  if (!type) return bad("Намуди эълонро интихоб кунед");
  if (!title || !description) return bad("Сарлавҳа ва тавсифро нависед");
  if (!CATEGORIES.some((c) => c.name === category)) return bad("Категория нодуруст аст");
  if (!(CITY_IDS as readonly string[]).includes(city)) return bad("Шаҳрро интихоб кунед");
  if (locationType && !LOCATION_TYPES.includes(locationType)) return bad("Ҷой нодуруст аст");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return bad("Сана нодуруст аст");
  if (reward && reward !== UNSPECIFIED_REWARD && !/^[1-9]\d{0,3}$/.test(reward)) return bad("Мукофот нодуруст аст");

  const rawImages = Array.isArray(body.images) ? body.images.slice(0, MAX_PHOTOS) : [];
  const images: { image_url: string; thumbnail_url: string | null }[] = [];
  if (isNoPhotoCategory(category)) {
    const placeholder = placeholderImageUrl(category);
    images.push({ image_url: placeholder, thumbnail_url: placeholder });
  } else {
    const allowed = (u: unknown): u is string => typeof u === "string" && (u.startsWith(BUCKET_PREFIX) || isPlaceholderUrl(u));
    for (const raw of rawImages) {
      const img = raw as { url?: unknown; thumb?: unknown };
      if (!allowed(img.url)) return bad("Акс нодуруст аст");
      images.push({ image_url: img.url, thumbnail_url: allowed(img.thumb) ? img.thumb : isPlaceholderUrl(img.url) ? img.url : null });
    }
  }

  try {
    // One small profile per person; the same name posted again reuses it.
    const personName = `${firstName} ${lastName}`;
    const { data: existing, error: findError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .like("id", `${INSTAGRAM_PROFILE_PREFIX}%`)
      .eq("last_name", personName)
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    let profileId = existing?.id as string | undefined;
    if (!profileId) {
      profileId = `${INSTAGRAM_PROFILE_PREFIX}${randomUUID()}`;
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({ id: profileId, first_name: INSTAGRAM_PROFILE_NAME, last_name: personName, avatar_url: INSTAGRAM_AVATAR_URL });
      if (profileError) throw profileError;
    }

    const itemRow = {
        user_id: profileId,
        title: maskSensitiveNumbers(title, category),
        description: maskSensitiveNumbers(description, category),
        category,
        type,
        phone_number: phone,
        contact_telegram: body.contact_telegram === true,
        contact_whatsapp: body.contact_whatsapp === true,
        handoff_type: type === "found" ? "self" : null,
        reward: type === "lost" ? reward || null : null,
        date,
        is_resolved: false,
        moderation_status: "approved",
        moderation_result: "Аз Instagram — админ гузошт",
        location_type: locationType,
        city,
      };
    const { data: item, error: itemError } = (await insertItemWithSource(
      (row) => supabaseAdmin.from("items").insert(row).select("id").single(),
      itemRow,
      "instagram",
    )) as { data: { id: string } | null; error: { code?: string } | null };
    if (itemError || !item) throw itemError ?? new Error("insert failed");

    if (images.length > 0) {
      const { error: imagesError } = await supabaseAdmin
        .from("item_images")
        .insert(images.map((img) => ({ item_id: item.id, ...img })));
      if (imagesError) {
        // A listing without its photos must not stay public.
        await supabaseAdmin.from("items").delete().eq("id", item.id);
        throw imagesError;
      }
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    console.error("POST /api/admin/post-instagram:", code ?? "error");
    return NextResponse.json({ error: "Хатогӣ рух дод. Боз кӯшиш кунед." }, { status: 500 });
  }
}
