/**
 * VIP/VVIP plan presentation + subscription status. No payment provider is
 * integrated this phase — "Subscribe" records a 'pending' purchase intent
 * only; an admin manually confirms payment before any benefit applies
 * (see the migration's header comment). This page never claims the user
 * is VIP/VVIP based on anything the client itself decided.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { VipService, type VipPlan, type MyVipStatus, type MySubscription } from "@/lib/services/vip-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const VIP_BENEFIT_KEYS = ["vipPlanText"];
const VVIP_BENEFIT_KEYS = ["vvipPlanText", "vvipPlanText2"];

export default function VipPage() {
  const { t } = useLanguage();
  const { getToken, userId, isLoaded } = useAuth();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [status, setStatus] = useState<MyVipStatus | null>(null);
  const [vvipSlot, setVvipSlot] = useState<{ isAvailable: boolean; availableAt: string | null } | null>(null);
  const [pending, setPending] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const [plansData, statusData, myHistory, slot] = await Promise.all([
        VipService.getPlans(supabase),
        userId ? VipService.getMyStatus(supabase) : Promise.resolve(null),
        userId ? VipService.getMySubscriptions(5, supabase) : Promise.resolve([]),
        VipService.getVvipAvailability(supabase).catch(() => null),
      ]);
      setVvipSlot(slot);
      setPlans(plansData);
      setStatus(statusData);
      setPending(myHistory.find((s) => s.status === "pending") ?? null);
    } catch (err) {
      console.error("vip page load:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  useEffect(() => {
    if (isLoaded) load();
  }, [isLoaded, load]);

  const handleSubscribe = async (plan: VipPlan) => {
    if (!userId) {
      toast.error(t("vipSignInRequired"));
      return;
    }
    setSubscribingPlanId(plan.id);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await VipService.createSubscription(plan.id, supabase);
      // Admins get the plan for free: the server activates their own request at price 0.
      // Anyone else gets a 404 here and stays on the normal "pending" flow.
      const activated = await fetch("/api/admin/subscriptions/self-activate", { method: "POST" })
        .then((r) => r.ok)
        .catch(() => false);
      toast.success(
        activated ? t("vipActivatedNotice").replace("%{tier}", (plan.tier === 'vvip' ? 'VIP' : 'TOP')) : t("vipRequestSent"),
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleCancelPending = async () => {
    if (!pending) return;
    setCancelling(true);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await VipService.cancelSubscription(pending.id, supabase);
      toast.success(t("success"));
      load();
    } catch {
      toast.error(t("error"));
    } finally {
      setCancelling(false);
    }
  };

  const vipPlans = plans.filter((p) => p.tier === "vip");
  const vvipPlans = plans.filter((p) => p.tier === "vvip");

  return (
    <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8 space-y-6">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-amber-50 dark:bg-amber-900/20 mx-auto">
          <Crown className="w-6 h-6 text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t("vipPageTitle")}</h1>
        <p className="text-sm text-zinc-500">{t("vipPageSubtitle")}</p>
      </div>

      {loading || !isLoaded ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      ) : (
        <>
          {status && (
            <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-center gap-3">
              <Crown className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {t("vipYouAre").replace("%{tier}", (status.tier === 'vvip' ? 'VIP' : 'TOP'))}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t("vipExpiresOn").replace("%{date}", format(new Date(status.expiresAt), "dd.MM.yyyy"))}
                </p>
              </div>
            </div>
          )}

          {pending && (
            <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("vipPendingLabel").replace("%{tier}", (pending.tier === 'vvip' ? 'VIP' : 'TOP'))}
                </p>
                <p className="text-xs text-slate-500">{t("vipPendingDesc")}</p>
              </div>
              <button
                type="button"
                onClick={handleCancelPending}
                disabled={cancelling}
                aria-label={t("cancel")}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <PlanGroup
            tier="vip"
            plans={vipPlans}
            benefitKeys={VIP_BENEFIT_KEYS}
            disabled={false}
            subscribingPlanId={subscribingPlanId}
            onSubscribe={handleSubscribe}
            t={t}
          />
          <PlanGroup
            tier="vvip"
            plans={vvipPlans}
            benefitKeys={VVIP_BENEFIT_KEYS}
            disabled={vvipSlot?.isAvailable === false}
            takenUntil={vvipSlot?.isAvailable === false ? (vvipSlot.availableAt ?? "") : undefined}
            subscribingPlanId={subscribingPlanId}
            onSubscribe={handleSubscribe}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function PlanGroup({
  tier,
  plans,
  benefitKeys,
  disabled,
  subscribingPlanId,
  takenUntil,
  onSubscribe,
  t,
}: {
  tier: "vip" | "vvip";
  plans: VipPlan[];
  benefitKeys: string[];
  disabled: boolean;
  subscribingPlanId: string | null;
  /** Set when the single VVIP slot is taken: ISO date it frees up ("" if unknown). */
  takenUntil?: string;
  onSubscribe: (plan: VipPlan) => void;
  t: (key: string) => string;
}) {
  if (plans.length === 0) return null;
  const isVvip = tier === "vvip";

  return (
    <div
      className={cn(
        "rounded-md border p-4 space-y-3",
        // Taken VVIP slot: whole card greyed out and not clickable.
        takenUntil !== undefined && "opacity-50 pointer-events-none select-none",
        isVvip
          ? "border-amber-300 dark:border-amber-900/60 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-zinc-800"
          : "border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800",
      )}
    >
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-base font-bold text-amber-600 dark:text-amber-400">{isVvip ? "VIP" : "TOP"}</h2>
      </div>
      <ul className="space-y-1">
        {benefitKeys.map((key) => (
          <li key={key} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            {t(key)}
          </li>
        ))}
      </ul>
      <div className={cn("grid gap-2", plans.length >= 3 ? "grid-cols-3" : plans.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            disabled={disabled || subscribingPlanId === plan.id}
            onClick={() => onSubscribe(plan)}
            className={cn(
              "rounded-md border p-2.5 text-center transition-colors disabled:opacity-50",
              "border-amber-600 dark:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20",
              isVvip && "bg-white/70 dark:bg-zinc-800/70",
            )}
          >
            <p className="text-[11px] font-semibold text-zinc-500">
              {plan.durationDays} {t("days")}
            </p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {plan.priceTjs} {plan.currency}
            </p>
          </button>
        ))}
      </div>
      {takenUntil !== undefined && (
        <p className="text-xs text-zinc-500">
          {t("vvipTakenNote").replace("%{date}", takenUntil ? format(new Date(takenUntil), "dd.MM.yyyy") : "")}
        </p>
      )}
    </div>
  );
}
