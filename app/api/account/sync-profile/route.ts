import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncProfileFromClerk } from "@/lib/services/profile-sync";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Called by the mobile app after sign-in: fills the caller's own empty
 * profile fields (email, name, avatar, phone) from Clerk. Auth: Clerk session
 * (Bearer token); scoped to the session's own userId — no body is read.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncProfileFromClerk(userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("POST /api/account/sync-profile:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
