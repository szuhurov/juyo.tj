/**
 * "Possible Matches" — Phase 5 AI Matching. Every row here is a computed
 * score + reasons between two DIFFERENT people's listings (one of them is
 * always the current user's own). This page never declares ownership and
 * never unlocks contact info on its own — it only surfaces the possibility
 * and links out to the two listings, where the existing phone/Telegram/
 * WhatsApp contact flow (unchanged) takes over.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { MatchService, type PossibleMatch, type MatchReason } from "@/lib/services/match-service";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Bot, ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const REASON_KEYS: Record<MatchReason, string> = {
  same_category: "matchReasonCategory",
  similar_title: "matchReasonTitle",
  similar_description: "matchReasonDescription",
  similar_image: "matchReasonImage",
  same_city: "matchReasonCity",
  similar_date: "matchReasonDate",
};

export default function MatchesPage() {
  const { t } = useLanguage();
  const { getToken, userId, isLoaded } = useAuth();
  const [matches, setMatches] = useState<PossibleMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const data = await MatchService.getMyPossibleMatches(30, supabase);
      setMatches(data);
    } catch (err) {
      console.error("getMyPossibleMatches:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  useEffect(() => {
    if (isLoaded) load();
  }, [isLoaded, load]);

  const handleDismiss = async (match: PossibleMatch) => {
    setDismissingId(match.matchId);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await MatchService.dismiss(match, supabase);
      setMatches((prev) => prev.filter((m) => m.matchId !== match.matchId));
    } catch {
      toast.error(t("error"));
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8">
      <div className="sticky top-0 z-30 bg-canvas py-3 mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <Link href="/notifications" className="text-slate-500 dark:text-zinc-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Bot className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-violet-500 shrink-0" />
        <h1 className="flex-1 text-base min-[1084px]:text-lg font-bold tracking-tight text-slate-500 dark:text-zinc-400 ml-1">
          {t("matchesPageTitle")}
        </h1>
      </div>

      {loading || !isLoaded ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-md" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
          <p className="text-sm min-[1084px]:text-base font-medium text-slate-400">{t("matchesEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.matchId}
              className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                  <Bot className="w-3.5 h-3.5" />
                  {t("matchScoreLabel").replace("%{score}", String(match.score))}
                </span>
                <button
                  type="button"
                  onClick={() => handleDismiss(match)}
                  disabled={dismissingId === match.matchId}
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
          ))}
        </div>
      )}
    </div>
  );
}
