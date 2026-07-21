import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Сохтани почтаи нав (то ҳанӯз тасдиқнашуда) барои раванди ивази email.
 * Тавассути Backend API (secret key) иҷро мешавад — на user.createEmailAddress()-и
 * клиент, зеро он баъзан reverification металабад (масалан вақте ки почтаи
 * қаблан аз ҳамин ҳисоб нест шударо дубора илова мекунед) ва ҳисобҳои бе
 * parol (масалан бо Google) ба "Cannot verify your account" дучор мешаванд.
 * Фиристодани рамзи тасдиқ (prepareVerification) ҳамчунон дар клиент
 * мемонад — он reverification намепурсад.
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

    // Агар кӯшиши қаблӣ нотамом монда бошад, ин почта аллакай ба ҳисоб
    // илова шудааст — ҳамонро истифода мебарем, на аз нав месозем.
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
