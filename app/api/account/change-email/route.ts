import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Пас аз он ки клиент почтаи навро бо рамз тасдиқ кард (attemptVerification —
 * ин қисм ҳамчунон дар клиент мемонад, ба reverification ниёз надорад), боқии
 * марҳилаҳо (асосӣ кардани почтаи нав, канда партофтани пайвасти беруна ва
 * нест кардани почтаи куҳна) аз ин ҷо — Backend API бо secret key — иҷро
 * мешаванд. Ин reverification (парол/телефон) талаб намекунад, пас
 * ҳисобҳои бе parol (масалан танҳо бо Google) низ бе "Cannot verify your
 * account" кор мекунанд.
 */
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
      const linkedAccounts = clerkUser.externalAccounts.filter((acc) => acc.emailAddress === oldEmail.emailAddress);
      for (const account of linkedAccounts) {
        try {
          await client.users.deleteUserExternalAccount({ userId, externalAccountId: account.id });
        } catch (unlinkErr: any) {
          console.error("deleteUserExternalAccount:", unlinkErr.message);
        }
      }
      try {
        await client.emailAddresses.deleteEmailAddress(oldEmail.id);
      } catch (destroyErr: any) {
        console.error("deleteEmailAddress:", destroyErr.message);
      }
    }

    await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail.emailAddress, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/account/change-email:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
