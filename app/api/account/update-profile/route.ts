import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

  const { firstName, lastName, phone, secondaryPhone } = await req.json();

  try {
    const client = await clerkClient();
    let avatarUrl: string | undefined;
    try {
      const clerkUser = await client.users.updateUser(userId, { firstName, lastName });
      avatarUrl = clerkUser.imageUrl;
    } catch (clerkErr: any) {
      console.error("Clerk updateUser error:", clerkErr?.errors ?? clerkErr?.message);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        secondary_phone: secondaryPhone,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err: any) {
    console.error("POST /api/account/update-profile:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
