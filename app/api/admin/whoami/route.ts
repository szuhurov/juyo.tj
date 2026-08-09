import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";

// Танҳо ба худи корбар мегӯяд, ки ӯ admin аст ё не (барои UI — масалан
// нишон додани item-и "Идоракунӣ" дар менюи профил). Ягон маълумоти
// ҳассос бармегардонад, пас 404-и пинҳонкунанда (мисли дигар admin route-ҳо) лозим нест.
export async function GET() {
  const { userId } = await auth();
  return NextResponse.json({ isAdmin: isAdminUser(userId) });
}
