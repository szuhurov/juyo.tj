"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminPostDetail } from "@/lib/hooks/use-admin-posts";
import { useUpdateAdminPost } from "@/lib/hooks/use-admin-posts";
import {
  MODERATION_DECISION_LABELS,
  NOT_CHECKED_BY_AI,
  reasonText,
  summarizeModeration,
  type ImageModeration,
} from "@/lib/image-moderation";

const TONE = {
  safe: "text-emerald-600 dark:text-emerald-400",
  review: "text-amber-600 dark:text-amber-400",
  block: "text-rose-600 dark:text-rose-400",
  unchecked: "text-zinc-400",
} as const;

/** Small AI label for the posts table (pending listings only — older ones were never scored). */
export function ModerationBadge({ images, pending }: { images: { moderation?: ImageModeration[] }[]; pending: boolean }) {
  const s = summarizeModeration(images);
  if (s.decision === "unchecked" && !pending) return null;
  const label = s.decision === "review" || s.decision === "block"
    ? `${s.decision === "block" ? "AI рад кард" : "AI"}: ${reasonText(s.reasons)}`
    : `AI: ${MODERATION_DECISION_LABELS[s.decision].toLowerCase()}`;
  return <span className={cn("text-[11px] font-semibold whitespace-nowrap", TONE[s.decision])}>{label}</span>;
}

/**
 * What the weapons model found, in plain words, for the moderator. The model
 * only triages: the admin decides. A rejection by the model can be undone
 * here (back to the review queue).
 */
export function PostModerationPanel({ item }: { item: AdminPostDetail["item"] }) {
  const update = useUpdateAdminPost(item.id);
  if (!item.images.length) return null;
  const s = summarizeModeration(item.images);
  const Icon = s.decision === "safe" ? ShieldCheck : s.decision === "unchecked" ? ShieldQuestion : ShieldAlert;
  const autoRejected = item.moderation_status === "rejected" && item.moderation_result === "mod_weapon";
  const rows = item.images.map((img) => img.moderation?.[0]).filter((m): m is ImageModeration => !!m);
  const model = rows[0]?.model_id;

  let text: string;
  if (s.decision === "block") text = `Модел бо эътимоди хеле баланд ёфт: ${reasonText(s.reasons)}. Эълон худкор рад шуд.`;
  else if (s.decision === "review") text = `Шояд дар акс бошад: ${reasonText(s.reasons)} Бодиққат бинед.`;
  else if (s.decision === "safe") text = "Силоҳ ва корд ёфт нашуд.";
  else text = "Модел ин аксҳоро санҷида натавонист (барномаи кӯҳна ё модел бор нашуд). Бо чашм санҷед.";

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3 text-xs space-y-1.5">
      <div className={cn("flex items-center gap-2 font-semibold text-sm", TONE[s.decision])}>
        <Icon className="h-4 w-4 shrink-0" />
        {MODERATION_DECISION_LABELS[s.decision]}
      </div>
      <p className="text-zinc-700 dark:text-zinc-300">{text}</p>
      <p className="text-zinc-500 dark:text-zinc-400">{NOT_CHECKED_BY_AI}</p>
      {!s.adminChecked && s.decision !== "unchecked" && (
        <p className="text-zinc-500 dark:text-zinc-400">Баҳо аз дастгоҳи муаллиф аст; браузери шумо онро аз нав ҳисоб мекунад.</p>
      )}
      {model && (
        <p className="text-[11px] text-zinc-400">
          Модел: {model}
          {rows.map((r, i) => r.scores && ` · акс ${i + 1}: ${Object.entries(r.scores).map(([k, v]) => `${k} ${Number(v).toFixed(2)}`).join(", ")}`)}
        </p>
      )}
      {autoRejected && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 mt-1"
          disabled={update.isPending}
          onClick={() => update.mutate({ moderation_status: "pending" })}
        >
          <Undo2 className="w-4 h-4" />
          Радро бекор кардан (ба навбат баргардонидан)
        </Button>
      )}
    </div>
  );
}
