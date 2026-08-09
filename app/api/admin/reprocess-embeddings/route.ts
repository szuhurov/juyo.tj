import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Backfill-и партияи калон (масалан садҳо ашё) метавонад аз маҳдудияти
// пешфарзи вақти Vercel (10с) зиёд шавад — ҳар ашё ду занги OpenAI мехоҳад.
// Vercel худаш инро ба ҳадди тарофаи лоиҳа маҳдуд мекунад, пас гузоштани
// қиммати баланд бехатар аст.
export const maxDuration = 300;

interface ItemImageRow {
  item_id: string;
  created_at: string;
  embedding: number[] | null;
  items: { title: string | null; description: string | null; status: string | null } | null;
}

// item_images-и як ашё якчанд акс дошта метавонад, вале generate-embedding
// ҳамеша танҳо АВВАЛИН акси ашёро (аз рӯи created_at) коркард мекунад — ҳамин
// тавр дар ҷои дигар низ истифода мешавад (ниг. app/(main)/items/add/page.tsx).
// Пас барои backfill бояд танҳо ашёҳое интихоб шаванд, ки аввалин акси онҳо
// embedding надорад.
async function findItemsMissingEmbedding(): Promise<{ itemId: string; text: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("item_images")
    .select("item_id, created_at, embedding, items(title, description, status)")
    .order("item_id", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<ItemImageRow[]>();
  if (error) throw error;

  const firstImageByItem = new Map<string, ItemImageRow>();
  for (const row of data ?? []) {
    if (!firstImageByItem.has(row.item_id)) firstImageByItem.set(row.item_id, row);
  }

  const targets: { itemId: string; text: string }[] = [];
  for (const [itemId, row] of firstImageByItem) {
    if (row.embedding) continue;
    if (row.items?.status === "deleted") continue;
    const text = `${row.items?.title ?? ""} ${row.items?.description ?? ""}`.trim();
    if (!text) continue;
    targets.push({ itemId, text });
  }
  return targets;
}

export async function GET() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const targets = await findItemsMissingEmbedding();
    return NextResponse.json({ missingCount: targets.length });
  } catch (err) {
    console.error("GET /api/admin/reprocess-embeddings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const targets = await findItemsMissingEmbedding();
    let processed = 0;
    let failed = 0;
    // Пай дар пай, на параллел — то ба квотаи OpenAI якбора зарба назанем.
    for (const target of targets) {
      const { error } = await supabaseAdmin.functions.invoke("generate-embedding", {
        body: { item_id: target.itemId, text: target.text },
      });
      if (error) failed += 1;
      else processed += 1;
    }

    return NextResponse.json({ total: targets.length, processed, failed });
  } catch (err) {
    console.error("POST /api/admin/reprocess-embeddings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
