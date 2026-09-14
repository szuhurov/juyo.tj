import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Creates a new (not yet verified) email for the email-change flow.
 * Carried out via the backend API (secret key) — not the client's
 * user.createEmailAddress(), because that sometimes requires
 * reverification (for example when re-adding an email that was previously
 * removed from this same account), and accounts without a password (for
 * example with Google) would hit "Cannot verify your account". Sending the
 * verification code (prepareVerification) still happens on the client —
 * that doesn't ask for reverification.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email лозим аст" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    // If a previous attempt was left incomplete, this email has already
    // been added to the account — we reuse it instead of creating a new one.
    const existing = clerkUser.emailAddresses.find(
      (e) => e.emailAddress.toLowerCase() === normalizedEmail,
    );
    if (existing) {
      return NextResponse.json({ ok: true, emailAddressId: existing.id });
    }

    const created = await client.emailAddresses.createEmailAddress({
      userId,
      emailAddress: normalizedEmail,
      verified: false,
      primary: false,
    });

    return NextResponse.json({ ok: true, emailAddressId: created.id });
  } catch (err) {
    const message = getErrorMessage(err);
    console.error("POST /api/account/start-email-change:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
