import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hardDeleteItem } from "@/lib/services/item-deletion";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Худи корбар эълони худро воқеан нест мекунад (на soft-delete-и
 * ItemService.deleteItem, ки барои "Ҳал шуд" низ истифода мешавад).
 * Native низ ҳамин route-ро бо Bearer-и Clerk занг мезанад (сервери худро
 * надорад — ниг. lib/account-api.ts барои ҳамин алго).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await hardDeleteItem(id, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/items/[id]/delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
