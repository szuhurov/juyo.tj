/**
 * Танҳо admin: илова кардани эълон аз номи ягон корбари дигар, бе гузаштан
 * аз санҷиши AI (ai-brain) — барои ҳолатҳое ки корбар худаш имкони
 * истифодаи wizard надорад (масалан тавассути Telegram/Instagram ба admin
 * менависад). Ҳимояи махфият тавассути мозаикаи ДАСТИИ admin (пеш аз
 * фиристодан ба ин route, дар клиент) таъмин мешавад — на AI.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

export async function POST(req: NextRequest) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const form = await req.formData();
    const targetUserId = String(form.get("user_id") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "Other");
    const type = form.get("type") === "found" ? "found" : "lost";
    const phone_number = String(form.get("phone_number") ?? "").trim();
    const reward = form.get("reward") ? String(form.get("reward")) : null;
    const images = form.getAll("image").filter((f): f is File => f instanceof File);

    if (!targetUserId || !title || !description) {
      return NextResponse.json({ error: "Майдонҳои ҳатмӣ холианд" }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Корбар ёфт нашуд" }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .insert({
        user_id: targetUserId,
        title,
        description,
        category,
        type,
        phone_number: phone_number || null,
        reward,
        date: new Date().toISOString().split("T")[0],
        is_resolved: false,
        moderation_status: "approved",
        moderation_result: `Дастӣ сабт аз admin (${adminId}) — мозаикаи дастӣ, бе санҷиши AI`,
      })
      .select("id")
      .single();
    if (itemError) throw itemError;

    const imageUrls: string[] = [];
    for (const file of images) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("items")
        .upload(fileName, buffer, { contentType: file.type || "image/jpeg" });
      if (uploadError) {
        console.error("Боркунии акс ноком шуд:", uploadError.message);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("items").getPublicUrl(fileName);
      imageUrls.push(publicUrl);
    }

    if (imageUrls.length > 0) {
      const { error: imgError } = await supabaseAdmin
        .from("item_images")
        .insert(imageUrls.map((url) => ({ item_id: item.id, image_url: url })));
      if (imgError) {
        console.error("item_images навишта нашуд:", imgError.message);
      } else {
        // Бе ин занг эълони admin-сабтшуда ҳеҷ вектор намегирифт ва дар
        // ҷустуҷӯи аксӣ тамоман пайдо намешуд — ҳол он ки маҳз ҳамин
        // эълонҳо аз Telegram/Instagram меоянд.
        const { error: embError } = await supabaseAdmin.functions.invoke("generate-embedding", {
          body: { item_id: item.id, text: `${title} ${description}` },
        });
        if (embError) console.error("generate-embedding ноком шуд:", embError.message);
      }
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (err) {
    console.error("POST /api/admin/post-as-user:", getErrorMessage(err));
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
