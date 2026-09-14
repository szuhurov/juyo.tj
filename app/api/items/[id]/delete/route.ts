import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hardDeleteItem } from "@/lib/services/item-deletion";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * The user themselves actually deletes their own post (not the soft-delete
 * of ItemService.deleteItem, which is also used for "Resolved").
 * Native also calls this same route with a Clerk Bearer token (it has no
 * server of its own — see lib/account-api.ts for the same algorithm).
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
