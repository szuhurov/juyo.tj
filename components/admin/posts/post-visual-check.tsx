"use client";

import { useEffect, useState } from "react";
import { ScanSearch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";
import type { AdminPostDetail } from "@/lib/hooks/use-admin-posts";
import { VISUAL_MODEL } from "@/lib/visual-model";
import { embedPhotoUrl } from "@/lib/visual-search";
import { cn } from "@/lib/utils";

type State =
  | { kind: "working" }
  | { kind: "done"; results: { image_id: string; author_match: number | null }[] }
  | { kind: "error" };

/** Below this the poster's vector did not come from this photo (benchmark: same file on two platforms ≥ 0.99). */
const AUTHOR_MATCH_OK = 0.95;

/**
 * Search by photo, admin side: this browser recomputes the vector of every
 * published photo of the listing (on this computer — the photo goes nowhere
 * else) and saves it as the authoritative one. Runs whenever the photos
 * change (also after "blur"). Shows whether the poster's device sent a
 * vector that matches the photo — a mismatch means a modified client.
 */
export function PostVisualCheck({ item }: { item: AdminPostDetail["item"] }) {
  const [state, setState] = useState<State>({ kind: "working" });
  const queryClient = useQueryClient();
  const urls = item.images.map((i) => i.image_url).join("|");

  useEffect(() => {
    if (!item.images.length) return;
    let cancelled = false;
    setState({ kind: "working" });
    (async () => {
      try {
        const images = [];
        for (const img of item.images) {
          const e = await embedPhotoUrl(img.image_url);
          images.push({ image_id: img.id, vector: e.vector, phash: e.phash });
        }
        const res = await fetch(`/api/admin/posts/${item.id}/embeddings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: VISUAL_MODEL.id, images }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: { image_id: string; author_match: number | null }[] };
        if (!cancelled) setState({ kind: "done", results: data.results });
        // The database re-scored moderation from these vectors — show the admin's result.
        queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.postDetail(item.id) });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // urls captures every photo change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, urls]);

  if (!item.images.length) return null;
  const mismatches = state.kind === "done" ? state.results.filter((r) => r.author_match != null && r.author_match < AUTHOR_MATCH_OK).length : 0;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-xs",
        mismatches ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400",
      )}
    >
      <ScanSearch className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {state.kind === "working" && "Ҷустуҷӯ бо акс: аксҳо дар ҳамин браузер таҳлил мешаванд…"}
        {state.kind === "error" && "Ҷустуҷӯ бо акс: ҳисоб нашуд (модел бор нашуд ё шабака нест). Саҳифаро аз нав кушоед."}
        {state.kind === "done" &&
          (mismatches
            ? `Ҷустуҷӯ бо акс: тайёр. Диққат: дар ${mismatches} акс маълумоти аз дастгоҳи муаллиф омада ба акс мувофиқ набуд — иваз карда шуд.`
            : "Ҷустуҷӯ бо акс: тайёр — баъди тасдиқ ин эълон дар ҷустуҷӯ бо акс пайдо мешавад.")}
      </span>
    </div>
  );
}
