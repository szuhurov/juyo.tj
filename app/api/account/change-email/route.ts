import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * After the client verifies the new email with a code (attemptVerification —
 * this part still happens on the client and doesn't require reverification),
 * the remaining steps (making the new email primary, unlinking the external
 * account, and deleting the old email) are carried out from here — a backend
 * API with the secret key. This doesn't require reverification
 * (password/phone), so accounts without a password (for example,
 * Google-only accounts) also work without hitting "Cannot verify your
 * account".
 */

/**
 * The Clerk backend SDK returns the identification ID (idn_...) in
 * ExternalAccount.id instead of the actual external account ID (eac_...) —
 * a known bug in the SDK itself (github.com/clerk/javascript/issues/7936).
 * Because of this, deleteUserExternalAccount with that ID always returned
 * 404, the link was never actually removed, and afterward deleting the old
 * email also failed (since it was still linked to the external account). To
 * get the real eac_..., we read the raw data directly from the REST API.
 */
async function getRawExternalAccounts(
  userId: string,
): Promise<Array<{ external_account_id: string; email_address: string }>> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.external_accounts ?? [];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newEmailId } = await req.json();
  if (typeof newEmailId !== "string" || !newEmailId) {
    return NextResponse.json({ error: "newEmailId лозим аст" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    const newEmail = clerkUser.emailAddresses.find((e) => e.id === newEmailId);
    if (!newEmail) {
      return NextResponse.json({ error: "Почта ёфт нашуд" }, { status: 404 });
    }

    const oldEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);

    await client.users.updateUser(userId, { primaryEmailAddressID: newEmailId });

    if (oldEmail && oldEmail.id !== newEmail.id) {
      const rawExternalAccounts = await getRawExternalAccounts(userId);
      const linkedAccounts = rawExternalAccounts.filter((acc) => acc.email_address === oldEmail.emailAddress);
      for (const account of linkedAccounts) {
        try {
          await client.users.deleteUserExternalAccount({ userId, externalAccountId: account.external_account_id });
        } catch (unlinkErr) {
          console.error("deleteUserExternalAccount:", getErrorMessage(unlinkErr));
        }
      }
      try {
        await client.emailAddresses.deleteEmailAddress(oldEmail.id);
      } catch (destroyErr) {
        console.error("deleteEmailAddress:", getErrorMessage(destroyErr));
      }
    }

    await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail.emailAddress, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/change-email:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
