import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Тағйири ном, насаб ва рақамҳои телефон. Номро дар Clerk тавассути
 * Backend API (бо secret key) иваз мекунад — на тавассути user.update()-и
 * клиент, зеро баъзе ҳисобҳо (масалан бо Google, ки ном аз IdP меояд)
 * ба "first_name is not a valid parameter for this request" ё
 * reverification дучор мешаванд. Дархости сервер-ба-сервер ин
 * маҳдудиятҳоро надорад. Агар навсозии Clerk бо ягон сабаб ноком шавад,
 * навсозии Supabase (манбаи асосии барнома) ҳамоно идома меёбад, то
 * корбар ҳаргиз ин хатогиро набинад.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { firstName, lastName, phone, secondaryPhone } = body;

  /**
   * Шабакаҳои иҷтимоӣ — ихтиёрӣ ва аз клиент меоянд, пас ҳар кадомро
   * ин ҷо маҳдуд мекунем: танҳо сатр, буридашуда, ва бо ҳадди дарозӣ
   * ки ба `check`-и миграция мувофиқ аст. Майдони НАФИРИСТОДАШУДА
   * тамоман ба `update` дохил намешавад, вагарна `undefined` қимати
   * мавҷударо мешуст. Сатри холӣ маънои «тоза кун» дорад → `null`.
   */
  const MAX = { telegram: 64, instagram: 64, whatsapp: 24, facebook: 64 } as const;
  const socials: Record<string, string | null> = {};
  for (const key of ["telegram", "instagram", "whatsapp", "facebook"] as const) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (typeof raw !== "string") continue;
    const v = raw.trim().slice(0, MAX[key]);
    socials[key] = v === "" ? null : v;
  }

  try {
    const client = await clerkClient();
    let avatarUrl: string | undefined;
    try {
      const clerkUser = await client.users.updateUser(userId, { firstName, lastName });
      avatarUrl = clerkUser.imageUrl;
    } catch (clerkErr) {
      console.error("Clerk updateUser error:", getErrorMessage(clerkErr));
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        phone,
        secondary_phone: secondaryPhone,
        ...socials,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    console.error("POST /api/account/update-profile:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
