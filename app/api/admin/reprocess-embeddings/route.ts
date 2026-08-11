import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Backfill-и партияи калон (масалан садҳо ашё) метавонад аз маҳдудияти
// пешфарзи вақти Vercel (10с) зиёд шавад — ҳар АКС ду занги OpenAI мехоҳад.
// Vercel худаш инро ба ҳадди тарофаи лоиҳа маҳдуд мекунад, пас гузоштани
// қиммати баланд бехатар аст. Бо вуҷуди ин partiя маҳдуд карда мешавад
// (ниг. DEFAULT_BATCH) — 300с барои сад ашё кифоя нест.
export const maxDuration = 300;

const DEFAULT_BATCH = 25;

interface ItemImageRow {
  item_id: string;
  created_at: string;
  embedding: number[] | null;
  image_url: string | null;
  items: { title: string | null; description: string | null; status: string | null } | null;
}

interface Target {
  itemId: string;
  text: string;
  missingImages: number;
  totalImages: number;
}

// generate-embedding акнун ҲАМАИ аксҳои ашёро коркард мекунад, пас ин ҷо
// ашёҳо ҷамъбаст мешаванд, на аксҳои алоҳида. `rebuildAll` ашёеро низ
// мегирад, ки аллакай вектор дорад — барои вақте ки модел ё prompt иваз
// шуд ва векторҳои кӯҳна дигар бо вектори дархост муқоисашаванда нестанд.
async function findTargets(rebuildAll: boolean): Promise<Target[]> {
  const { data, error } = await supabaseAdmin
    .from("item_images")
    .select("item_id, created_at, embedding, image_url, items(title, description, status)")
    .order("item_id", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<ItemImageRow[]>();
  if (error) throw error;

  const byItem = new Map<string, Target>();
  for (const row of data ?? []) {
    if (row.items?.status === "deleted") continue;

    let target = byItem.get(row.item_id);
    if (!target) {
      target = {
        itemId: row.item_id,
        text: `${row.items?.title ?? ""} ${row.items?.description ?? ""}`.trim(),
        missingImages: 0,
        totalImages: 0,
      };
      byItem.set(row.item_id, target);
    }
    target.totalImages += 1;
    if (!row.embedding) target.missingImages += 1;
  }

  return [...byItem.values()].filter((t) =>
    rebuildAll ? t.totalImages > 0 : t.missingImages > 0,
  );
}

export async function GET() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [missing, all] = await Promise.all([findTargets(false), findTargets(true)]);
    return NextResponse.json({
      missingCount: missing.length,
      totalCount: all.length,
      missingImages: missing.reduce((sum, t) => sum + t.missingImages, 0),
      totalImages: all.reduce((sum, t) => sum + t.totalImages, 0),
    });
  } catch (err) {
    console.error("GET /api/admin/reprocess-embeddings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const rebuildAll = url.searchParams.get("all") === "true";
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_BATCH)),
    );

    const targets = await findTargets(rebuildAll);
    const batch = targets.slice(0, limit);

    let processed = 0;
    let failed = 0;
    // Пай дар пай, на параллел — то ба квотаи OpenAI якбора зарба назанем.
    for (const target of batch) {
      const { error } = await supabaseAdmin.functions.invoke("generate-embedding", {
        body: {
          item_id: target.itemId,
          text: target.text,
          force: rebuildAll,
        },
      });
      if (error) failed += 1;
      else processed += 1;
    }

    return NextResponse.json({
      total: targets.length,
      batchSize: batch.length,
      processed,
      failed,
      remaining: Math.max(0, targets.length - batch.length),
    });
  } catch (err) {
    console.error("POST /api/admin/reprocess-embeddings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
