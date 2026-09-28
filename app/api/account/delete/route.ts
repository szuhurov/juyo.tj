import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteUserAccount } from "@/lib/services/account-deletion";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * The user deletes their own account (Settings → "Delete account"). Deletes
 * both Clerk and Supabase directly from here (a backend API, with the
 * secret key) — not via the client's user.delete(), because that requires
 * reverification (password/phone), which many accounts (for example,
 * Google accounts without a password) don't have and would hit "Cannot
 * verify your account". A server-to-server request doesn't have this
 * requirement.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteUserAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
