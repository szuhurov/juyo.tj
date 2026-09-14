import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Updates the first name, last name, and phone numbers. Changes the name
 * in Clerk via the backend API (with the secret key) — not via the
 * client's user.update(), because some accounts (for example with Google,
 * where the name comes from the IdP) hit "first_name is not a valid
 * parameter for this request" or reverification. A server-to-server
 * request doesn't have these restrictions. If the Clerk update fails for
 * any reason, the Supabase update (the app's primary data source) still
 * proceeds, so the user never sees this error.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { firstName, lastName, phone, secondaryPhone } = body;

  /**
   * Social networks — optional and coming from the client, so we
   * constrain each one here: string only, trimmed, and capped at a
   * length that matches the migration's `check`. A field that was NOT
   * SENT is not included in `update` at all, otherwise `undefined` would
   * wipe out the existing value. An empty string means "clear it" →
   * `null`.
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
