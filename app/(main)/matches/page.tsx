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
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { MatchService, type PossibleMatch } from "@/lib/services/match-service";
import { MatchCard, MatchCardSkeleton } from "@/components/match-card";
import { Bot, ArrowLeft, Sparkles } from "lucide-react";



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
            <MatchCardSkeleton key={i} />
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
            <MatchCard
              key={match.matchId}
              match={match}
              onDismiss={handleDismiss}
              dismissing={dismissingId === match.matchId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
