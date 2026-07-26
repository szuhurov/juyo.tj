import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteUserAccount } from "@/lib/services/account-deletion";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Худи корбар ҳисоби худро нест мекунад (Танзимот → "Нест кардани ҳисоб").
 * Ҳам Clerk ва ҳам Supabase-ро мустақим аз ин ҷо (Backend API, бо
 * secret key) нест мекунад — на тавассути user.delete()-и клиент, зеро он
 * reverification талаб мекунад (парол/телефон), ки бисёр ҳисобҳо (масалан
 * бо Google бе парол) надоранд ва ба "Cannot verify your account" дучор
 * мешаванд. Дархости сервер-ба-сервер ин талаботро надорад.
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
