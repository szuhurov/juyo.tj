"use client";

/**
 * One "possible match" card — shared by /matches and the profile's
 * "Matches" filter (the app's MatchCard is likewise used in both places).
 */
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/language-context";
import type { PossibleMatch, MatchReason } from "@/lib/services/match-service";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Bot, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const REASON_KEYS: Record<MatchReason, string> = {
  same_category: "matchReasonCategory",
  similar_title: "matchReasonTitle",
  similar_description: "matchReasonDescription",
  similar_image: "matchReasonImage",
  same_city: "matchReasonCity",
  similar_date: "matchReasonDate",
};

export /** Same card, rows and sizes as a loaded match card below (and the app's MatchCardSkeleton). */
function MatchCardSkeleton() {
  return (
    <div aria-hidden className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="w-16 h-16 rounded-md shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center gap-2">
            <Skeleton className="h-3.5 w-3/5 rounded" />
            <Skeleton className="h-4 w-11 rounded-full shrink-0" />
          </div>
          <div className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["w-16", "w-20", "w-14"].map((w) => (
          <Skeleton key={w} className={`h-5 ${w} rounded-full`} />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

export function MatchCard({
  match,
  onDismiss,
  dismissing,
}: {
  match: PossibleMatch;
  onDismiss: (match: PossibleMatch) => void;
  dismissing: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
          <Bot className="w-3.5 h-3.5" />
          {t("matchScoreLabel").replace("%{score}", String(match.score))}
        </span>
        <button
          type="button"
          onClick={() => onDismiss(match)}
          disabled={dismissing}
          aria-label={t("dismiss")}
          className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
  
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0 bg-slate-100 dark:bg-zinc-700">
          {match.otherItemImageUrl ? (
            <Image src={match.otherItemImageUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <ImagePlaceholder />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {match.otherItemTitle}
            </p>
            <span
              className={cn(
                "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700",
                match.otherItemType === "lost" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {match.otherItemType === "lost" ? t("lost") : t("found")}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            {t("matchAgainstYourItem")}: {match.myItemTitle}
          </p>
        </div>
      </div>
  
      <div className="flex flex-wrap gap-1.5">
        {match.reasons.map((reason) => (
          <span
            key={reason}
            className="inline-flex items-center rounded-full bg-slate-50 dark:bg-zinc-700/50 border border-hairline dark:border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-zinc-400"
          >
            {t(REASON_KEYS[reason])}
          </span>
        ))}
      </div>
  
      <Link
        href={`/items/${match.otherItemId}`}
        className="flex items-center justify-center gap-2 h-10 rounded-md bg-emerald-500 text-white font-medium text-xs hover:bg-emerald-600 transition-colors"
      >
        {t("matchViewListing")}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
