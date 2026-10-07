/**
 * Admin-side view of the image moderation results (computed in the database
 * from the visual-search vector — supabase/migrations/20261007010000).
 * Plain labels only; raw scores stay in the detail view's "technical" line.
 */

export type ModerationDecision = "safe" | "review" | "block";
export type ModerationSource = "author" | "admin" | "backfill";

export interface ImageModeration {
  decision: ModerationDecision;
  reasons: string[];
  source: ModerationSource;
  model_id?: string;
  scores?: Record<string, number>;
}

export const MODERATION_REASON_LABELS: Record<string, string> = {
  firearm: "Силоҳ?",
  blade: "Корд?",
};

export const MODERATION_DECISION_LABELS: Record<ModerationDecision | "unchecked", string> = {
  safe: "Бехатар",
  review: "Санҷиш лозим",
  block: "Рад шуд (AI)",
  unchecked: "Санҷида нашуд",
};

/** Categories with no model yet: the admin checks them by eye. */
export const NOT_CHECKED_BY_AI = "Бараҳнагӣ ва хун (gore) санҷида намешаванд — бо чашм бинед.";

export interface ModerationSummary {
  decision: ModerationDecision | "unchecked";
  reasons: string[];
  /** Every photo was scored from a vector the admin's browser computed. */
  adminChecked: boolean;
}

/** The listing's state is its worst photo; a photo without a score makes the listing "unchecked" unless another photo already flags it. */
export function summarizeModeration(images: { moderation?: ImageModeration[] | null }[]): ModerationSummary {
  const rows = images.map((i) => i.moderation?.[0] ?? null);
  const scored = rows.filter((r): r is ImageModeration => !!r);
  const reasons = [...new Set(scored.flatMap((r) => r.reasons))];
  const adminChecked = rows.length > 0 && rows.every((r) => r && r.source !== "author");
  if (scored.some((r) => r.decision === "block")) return { decision: "block", reasons, adminChecked };
  if (scored.some((r) => r.decision === "review")) return { decision: "review", reasons, adminChecked };
  if (rows.length === 0 || scored.length < rows.length) return { decision: "unchecked", reasons, adminChecked };
  return { decision: "safe", reasons, adminChecked };
}

export function reasonText(reasons: string[]) {
  return reasons.map((r) => MODERATION_REASON_LABELS[r] ?? r).join(", ");
}
