/**
 * Organization post review queue — staff (owner/admin/branch_manager)
 * approve/reject posts associated with their organization. "Approved"
 * here means only "this organization confirms the post relates to them" —
 * never ownership verification, never Claim/Verification. Rejecting never
 * deletes the underlying personal post (server-enforced; this page just
 * reflects that).
 */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { OrganizationItemService, type OrganizationReviewQueueItem } from "@/lib/services/organization-item-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Check, X, ArrowRight, PackagePlus, BarChart3 } from "lucide-react";
import { OrganizationService, type MyOrganization } from "@/lib/services/organization-service";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function OrganizationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = use(params);
  const { t } = useLanguage();
  const { getToken, userId, isLoaded } = useAuth();
  const [queue, setQueue] = useState<OrganizationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyOrganization | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const [data, orgs] = await Promise.all([
        OrganizationItemService.getReviewQueue(organizationId, undefined, supabase),
        OrganizationService.getMyOrganizations(supabase).catch(() => []),
      ]);
      setQueue(data);
      setMine(orgs.find((o) => o.organizationId === organizationId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, getToken, t]);

  const canCreateFound = mine && ["owner", "admin", "branch_manager", "staff"].includes(mine.role);

  useEffect(() => {
    if (isLoaded) load();
  }, [isLoaded, load]);

  const handleApprove = async (itemId: string) => {
    setActingId(itemId);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await OrganizationItemService.approvePost(itemId, supabase);
      toast.success(t("orgReviewApprovedToastShort"));
      setQueue((prev) => prev.filter((q) => q.itemId !== itemId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (itemId: string) => {
    setActingId(itemId);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await OrganizationItemService.rejectPost(itemId, undefined, supabase);
      toast.success(t("orgReviewRejectedToastShort"));
      setQueue((prev) => prev.filter((q) => q.itemId !== itemId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8">
      <div className="sticky top-0 z-30 bg-canvas py-3 mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <Building2 className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-sky-500 shrink-0" />
        <h1 className="flex-1 text-base min-[1084px]:text-lg font-bold tracking-tight text-slate-500 dark:text-zinc-400 ml-1">
          {t("orgReviewQueueTitle")}
        </h1>
        {mine && (
          <Link
            href={`/org/${organizationId}/analytics`}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#f2f6fa] dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold"
          >
            <BarChart3 className="w-4 h-4" /> {t("orgAnalyticsTitle")}
          </Link>
        )}
        {canCreateFound && (
          <Link
            href={`/org/${organizationId}/found`}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold"
          >
            <PackagePlus className="w-4 h-4" /> {t("orgFoundCreateTitle")}
          </Link>
        )}
      </div>

      {loading || !isLoaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="py-20 text-center text-sm font-medium text-red-500">{error}</p>
      ) : queue.length === 0 ? (
        <p className="py-20 text-center text-sm min-[1084px]:text-base font-medium text-slate-400">{t("orgReviewQueueEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {queue.map((post) => (
            <div
              key={post.itemId}
              className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold text-sm min-[1084px]:text-base text-zinc-900 dark:text-zinc-100">
                  {post.title}
                </p>
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700",
                    post.type === "lost" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {post.type === "lost" ? t("lost") : t("found")}
                </span>
                {post.isOrganizationOwned && (
                  <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400">
                    {t("orgOwnedPostBadge")}
                  </span>
                )}
              </div>
              <Link
                href={`/items/${post.itemId}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600"
              >
                {t("orgReviewViewPost")} <ArrowRight className="w-3 h-3" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={actingId === post.itemId}
                  onClick={() => handleApprove(post.itemId)}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md bg-emerald-500 text-white font-medium text-xs disabled:opacity-60 transition-colors"
                >
                  <Check className="w-4 h-4" /> {t("orgReviewApprove")}
                </button>
                <button
                  type="button"
                  disabled={actingId === post.itemId}
                  onClick={() => handleReject(post.itemId)}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-900/20 font-medium text-xs disabled:opacity-60 transition-colors"
                >
                  <X className="w-4 h-4" /> {t("orgReviewReject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
