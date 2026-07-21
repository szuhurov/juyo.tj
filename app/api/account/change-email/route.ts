import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Пас аз он ки клиент почтаи навро бо рамз тасдиқ кард (attemptVerification —
 * ин қисм ҳамчунон дар клиент мемонад, ба reverification ниёз надорад), боқии
 * марҳилаҳо (асосӣ кардани почтаи нав, канда партофтани пайвасти беруна ва
 * нест кардани почтаи куҳна) аз ин ҷо — Backend API бо secret key — иҷро
 * мешаванд. Ин reverification (парол/телефон) талаб намекунад, пас
 * ҳисобҳои бе parol (масалан танҳо бо Google) низ бе "Cannot verify your
 * account" кор мекунанд.
 */

/**
 * Backend SDK-и Clerk дар ExternalAccount.id ба ҷои ID-и воқеии ҳисоби
 * беруна (eac_...) ID-и identification (idn_...)-ро бармегардонад — хатои
 * маълуми худи SDK (github.com/clerk/javascript/issues/7936). Аз ин сабаб
 * deleteUserExternalAccount бо он ID ҳамеша 404 медод, пайваст воқеан
 * канда намешуд ва баъд нест кардани почтаи куҳна низ ноком мешуд (зеро
 * он то ҳол ба ҳисоби беруна пайваст буд). Барои гирифтани eac_... воқеӣ,
 * маълумоти хомро мустақим аз REST API мехонем.
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
