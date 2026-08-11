/**
 * Векторҳои visual-search-ро аз нав месозад.
 *
 * Вақте ки модели embedding ё forensic prompt иваз мешавад, векторҳои
 * кӯҳна дигар бо вектори дархост дар як фазо нестанд — ҷустуҷӯ ашёи
 * нодуруст мебарорад. Ин скрипт ҳамаро аз нав месозад.
 *
 *   npx tsx --env-file=.env.local scripts/rebuild-embeddings.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/rebuild-embeddings.ts
 *
 * --dry-run  — танҳо нишон медиҳад, ки чанд ашё коркард мешавад
 * --missing  — танҳо аксҳои бе вектор (арзонтар, барои backfill-и оддӣ)
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const MISSING_ONLY = process.argv.includes("--missing");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ва SUPABASE_SERVICE_ROLE_KEY лозиманд (.env.local)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface Row {
  item_id: string;
  embedding: number[] | null;
  items: { title: string | null; description: string | null; status: string | null } | null;
}

async function main() {
  const { data, error } = await supabase
    .from("item_images")
    .select("item_id, embedding, items(title, description, status)")
    .order("item_id", { ascending: true })
    .returns<Row[]>();

  if (error) throw error;

  const byItem = new Map<string, { text: string; images: number; missing: number }>();
  for (const row of data ?? []) {
    if (row.items?.status === "deleted") continue;
    let entry = byItem.get(row.item_id);
    if (!entry) {
      entry = {
        text: `${row.items?.title ?? ""} ${row.items?.description ?? ""}`.trim(),
        images: 0,
        missing: 0,
      };
      byItem.set(row.item_id, entry);
    }
    entry.images += 1;
    if (!row.embedding) entry.missing += 1;
  }

  const targets = [...byItem.entries()].filter(([, e]) =>
    MISSING_ONLY ? e.missing > 0 : e.images > 0,
  );
  const imageCount = targets.reduce(
    (sum, [, e]) => sum + (MISSING_ONLY ? e.missing : e.images),
    0,
  );

  console.log(
    `${targets.length} ашё / ${imageCount} акс ${MISSING_ONLY ? "(танҳо бе вектор)" : "(ҳама, force)"}`,
  );
  if (DRY_RUN) {
    console.log("--dry-run — ҳеҷ чиз тағйир наёфт");
    return;
  }

  let processed = 0;
  let failed = 0;
  const failedIds: string[] = [];

  // Пай дар пай — ҳар акс ду занги OpenAI мехоҳад; параллел рафтан
  // ба маҳдудияти квота мезанад.
  //
  // Такрор ҳатмист: дар гузариши аввал 65 аз 99 ашё ноком шуд, вале
  // ҳамон ашёҳо дар кӯшиши дуюм бе ягон тағйирот 200 доданд — яъне
  // хатоҳо гузаранда буданд (маҳдудияти суръати OpenAI), на воқеӣ.
  for (const [itemId, entry] of targets) {
    let ok = false;
    let lastError = "";

    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));

      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "generate-embedding",
        { body: { item_id: itemId, text: entry.text, force: !MISSING_ONLY } },
      );

      if (invokeError) {
        lastError = invokeError.message;
        continue;
      }

      ok = true;
      processed += 1;
      const r = result as { processed?: number; skipped?: number; errors?: string[] };
      const retried = attempt > 0 ? ` [кӯшиши ${attempt + 1}]` : "";
      const suffix = r?.errors?.length ? ` (хатоҳо: ${r.errors.join("; ")})` : "";
      console.log(
        `✓ ${processed + failed}/${targets.length} ${itemId} — ${r?.processed ?? 0} акс${retried}${suffix}`,
      );
    }

    if (!ok) {
      failed += 1;
      failedIds.push(itemId);
      console.error(`✗ ${itemId}: ${lastError}`);
    }

    // Нафаси кӯтоҳ байни ашёҳо — маҳдудияти суръати OpenAI-ро сабук мекунад.
    await sleep(400);
  }

  console.log(`\nТамом: ${processed} муваффақ, ${failed} ноком`);
  if (failedIds.length > 0) {
    console.log(`Ноком: ${failedIds.join(", ")}`);
    process.exitCode = 1;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
