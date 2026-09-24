/**
 * Full notifications page — new listings in the user's categories.
 * Each row doesn't navigate to the listing page — instead it expands
 * right here (the listing's photo + a "View listing" link). Unread rows
 * have a different color; expanding a row switches that row's color to normal.
 * Deletion happens via the trash button in the expanded row, or via
 * group selection.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, type NotificationItem } from "@/lib/hooks/use-notifications";
import { ClaimantAvatar } from "@/components/claimant-avatar";
import { Bell, BellRing, ChevronDown, ArrowRight, Trash2, CheckCheck, CheckSquare, X, CheckCircle2, Bot, Crown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWebPush } from "@/lib/hooks/use-web-push";

type SectionHeader = { key: string; header: string };

// Time-limited expiry notices stay pinned on top ("Important"); everything
// else is one chronological feed split into Today / Yesterday / Earlier.
function buildSections(items: NotificationItem[], t: (key: string) => string): (NotificationItem | SectionHeader)[] {
  const pinned = items.filter((i) => i.kind === "expiry_confirm");
  const rest = items
    .filter((i) => i.kind !== "expiry_confirm")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const out: (NotificationItem | SectionHeader)[] = [];
  if (pinned.length > 0) out.push({ key: "h-important", header: t("notifSectionImportant") }, ...pinned);
  let last: string | null = null;
  for (const item of rest) {
    const d = new Date(item.createdAt);
    const bucket = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : "Earlier";
    if (bucket !== last) {
      out.push({ key: "h-" + bucket, header: t("notifSection" + bucket) });
      last = bucket;
    }
    out.push(item);
  }
  return out;
}

function NotificationRow({
  item,
  unread,
  expanded,
  selected,
  onToggle,
  onDeleteClick,
  onExpiryRespond,
  responding,
  t,
}: {
  item: NotificationItem;
  unread: boolean;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onDeleteClick: () => void;
  onExpiryRespond: (action: "keep" | "delete") => void;
  responding: boolean;
  t: (key: string) => string;
}) {
  const isExpiry = item.kind === "expiry_confirm";
  const isAiMatch = item.kind === "ai_match";
  const isVipStatus = item.kind === "vip_status";
  const isOrgReview = item.kind === "org_review_pending" || item.kind === "org_review_result";
  // The current time is captured in an effect, not during render: calling
  // `Date.now()` during render is an impure function, and the server's time
  // won't match the browser's time, causing a hydration mismatch. `null`
  // until mount — during that time the time row isn't shown at all.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!isExpiry) return;
    // Sync with the browser's clock (a system outside React) — the same
    // pattern as `mounted` in components/header.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isExpiry]);

  const hoursLeft =
    nowMs === null
      ? null
      : Math.max(
          0,
          Math.ceil((new Date(item.expiryDeadline ?? item.createdAt).getTime() - nowMs) / 3_600_000),
        );

  const handleClick = () => {
    onToggle();
  };

  return (
    <div className="relative">
      {/* Swipe-to-delete was removed. Deletion has two clear paths:
          the trash button in the expanded row, and group selection. */}
      <div
        className={cn(
          // User request: no card container — the avatar sits on the page
          // gutter like every other row. The opaque canvas background stays so
          // the swipe-revealed trash button behind the row is hidden at rest.
          "relative z-10 bg-canvas",
          selected && "rounded-md ring-2 ring-emerald-500",
        )}
      >
        <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 py-3 text-left"
      >
        <div className="relative shrink-0">
          {isAiMatch ? (
            <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <Bot className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-violet-500" />
            </div>
          ) : isVipStatus ? (
            <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Crown className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-amber-500" />
            </div>
          ) : isOrgReview ? (
            <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-sky-500" />
            </div>
          ) : (
            <ClaimantAvatar url={item.posterAvatar ?? null} name={item.posterName ?? null} className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 text-sm min-[1084px]:text-base" />
          )}
          {selected && (
            <CheckCircle2 className="absolute -bottom-1 -right-1 w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-emerald-500 bg-white dark:bg-zinc-800 rounded-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm min-[1084px]:text-base font-semibold text-zinc-800 dark:text-zinc-200">
              {item.itemTitle}
            </p>
            {item.itemType && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] min-[1084px]:text-[10px] min-[1920px]:text-[11px] font-medium bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700",
                  item.itemType === "lost"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {item.itemType === "lost" ? t("lost") : t("found")}
              </span>
            )}
          </div>
          {isExpiry ? (
            <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs font-medium mt-1 text-amber-700 dark:text-amber-500">
              {hoursLeft === null ? " " : t("expiryNotice").replace("%{hours}", String(hoursLeft))}
            </p>
          ) : isAiMatch ? (
            <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs font-semibold mt-1 text-violet-600 dark:text-violet-400">
              {t("aiMatchScoreLabel").replace("%{score}", String(item.matchScore ?? 0))}
            </p>
          ) : isVipStatus ? (
            <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs font-semibold mt-1 text-amber-600 dark:text-amber-400">
              {t(item.vipEventType === "expired" ? "vipExpiredNotice" : "vipActivatedNotice").replace("%{tier}", item.itemTitle)}
            </p>
          ) : isOrgReview ? (
            <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs font-semibold mt-1 text-sky-600 dark:text-sky-400">
              {item.kind === "org_review_pending"
                ? t("orgReviewPendingNotice").replace("%{organization}", item.organizationName ?? "")
                : t(item.organizationReviewStatus === "approved" ? "orgReviewApprovedNotice" : "orgReviewRejectedNotice").replace(
                    "%{organization}",
                    item.organizationName ?? "",
                  )}
            </p>
          ) : (
            <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs text-slate-400 dark:text-zinc-500 font-medium mt-1">
              {format(new Date(item.createdAt), "dd.MM.yyyy HH:mm")}
            </p>
          )}
        </div>
        {unread && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
        <ChevronDown
          className={cn(
            "w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5 text-slate-400 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="pb-4 pt-1">
          {item.itemImageUrl && (
            <div className="relative w-full h-40 min-[1084px]:h-48 min-[1920px]:h-56 rounded-md overflow-hidden mb-3">
              <Image
                src={item.itemImageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover"
              />
            </div>
          )}
          {isExpiry ? (
            /* Two clear choices. The "delete" button, unlike `onDeleteClick`
               (which dismisses the notification), deletes the ACTUAL listing
               — so its red color and text need to convey that meaning. */
            <>
              <p className="mb-3 text-xs min-[1084px]:text-sm font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
                {t("expiryQuestion")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={responding}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpiryRespond("keep");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-11 min-[1084px]:h-12 rounded-md bg-emerald-500 text-white font-medium text-xs min-[1084px]:text-sm disabled:opacity-60 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px]" />
                  {t("expiryKeep")}
                </button>
                <button
                  type="button"
                  disabled={responding}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpiryRespond("delete");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-11 min-[1084px]:h-12 rounded-md bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-900/20 font-medium text-xs min-[1084px]:text-sm disabled:opacity-60 transition-colors"
                >
                  <Trash2 className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px]" />
                  {t("expiryDelete")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href={
                  isAiMatch
                    ? "/matches"
                    : isVipStatus
                      ? "/vip"
                      : item.kind === "org_review_pending"
                        ? `/org/${item.organizationId}/review`
                        : `/items/${item.itemId}`
                }
                className="flex-1 flex items-center justify-center gap-2 h-11 min-[1084px]:h-12 min-[1920px]:h-[52px] rounded-md bg-emerald-500 text-white font-medium text-xs min-[1084px]:text-sm shadow-sm hover:shadow-md transition-all"
              >
                {isAiMatch
                  ? t("aiMatchViewButton")
                  : isVipStatus
                    ? t("vipViewButton")
                    : item.kind === "org_review_pending"
                      ? t("orgReviewGoToQueue")
                      : item.itemTitle}
                <ArrowRight className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick();
                }}
                className="h-11 w-11 min-[1084px]:h-12 min-[1084px]:w-12 min-[1920px]:h-[52px] min-[1920px]:w-[52px] shrink-0 flex items-center justify-center rounded-md bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5" />
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { items, loading, markOpened, markAllOpened, isOpened, dismissNotification, respondToExpiry } =
    useNotifications({ categoryLimit: 100 });
  const { status, subscribed, subscribe, unsubscribe } = useWebPush();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  // Which notification is currently sending a response — so the buttons can't be double-clicked.
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const handleExpiryRespond = async (item: NotificationItem, action: "keep" | "delete") => {
    if (respondingId) return;
    setRespondingId(item.id);
    try {
      await respondToExpiry(item, action);
      toast.success(action === "keep" ? t("expiryKeptToast") : t("success"));
    } catch {
      toast.error(t("error"));
    } finally {
      setRespondingId(null);
    }
  };

  // Deleting asks first, in the same centered dialog as deleting a listing.
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = (item: NotificationItem) => setDeleteTarget(item);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dismissNotification(deleteTarget);
      setDeleteTarget(null);
    } catch {
      toast.error(t("error"));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const targets = items;
    setSelectMode(false);
    try {
      await Promise.all(targets.map((item) => dismissNotification(item)));
    } catch {
      toast.error(t("error"));
    }
  };

  const toggleExpand = (item: NotificationItem) => {
    markOpened(item.id);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8">
      <div className="sticky top-0 z-30 bg-canvas py-3 mb-4 flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800">
        <Bell className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 text-slate-500 dark:text-zinc-400 shrink-0" />
        <h1 className="flex-1 text-base min-[1084px]:text-lg min-[1920px]:text-xl font-bold tracking-tight text-slate-500 dark:text-zinc-400 ml-1">
          {t("notifPageTitle")}
        </h1>
        {items.length > 0 && !selectMode && (
          <>
            <button
              type="button"
              onClick={markAllOpened}
              aria-label={t("notifMarkAllRead")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-md flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <CheckCheck className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              aria-label={t("notifSelectAll")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-md flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <CheckSquare className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
          </>
        )}
        {selectMode && (
          <>
            <button
              type="button"
              onClick={() => setSelectMode(false)}
              aria-label={t("notifCancelSelect")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-md flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              aria-label={t("notifDeleteAll")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-md flex items-center justify-center text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
          </>
        )}
      </div>

      {status !== "unsupported" && (
        <div className="flex items-center gap-3 rounded-md p-4 mb-5 bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700">
          <BellRing className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 text-slate-500 dark:text-zinc-400 shrink-0" />
          <span className="flex-1 text-sm min-[1084px]:text-base min-[1920px]:text-[17px] font-semibold text-slate-500 dark:text-zinc-400">
            {t("verifyEnablePush")}
          </span>
          <Switch
            checked={subscribed}
            disabled={status === "denied"}
            onCheckedChange={(checked) => {
              if (checked) subscribe();
              else unsubscribe();
            }}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        // Geometry matches NotificationRow: the same rounded-md, the same
        // p-4, the same avatar and row sizes — so the list doesn't jump
        // when the data arrives.
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="py-3 flex items-center gap-3"
            >
              <Skeleton className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 rounded-full shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 min-[1084px]:h-4 w-3/5 rounded" />
                <Skeleton className="h-2.5 min-[1084px]:h-3 w-24 rounded" />
              </div>
              <Skeleton className="w-4 h-4 rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-sm min-[1084px]:text-base font-medium text-slate-400">{t("notifEmpty")}</div>
      ) : (
        <div className="space-y-1">
          {buildSections(items, t).map((item) =>
            "header" in item ? (
              <p key={item.key} className="pt-3 text-xs min-[1084px]:text-[13px] font-semibold text-slate-400 dark:text-zinc-500">
                {item.header}
              </p>
            ) : (
            <NotificationRow
              key={item.id}
              item={item}
              unread={!isOpened(item.id)}
              expanded={expandedId === item.id}
              selected={selectMode}
              onToggle={() => toggleExpand(item)}
              onDeleteClick={() => handleDelete(item)}
              onExpiryRespond={(action) => handleExpiryRespond(item, action)}
              responding={respondingId === item.id}
              t={t}
            />
            ),
          )}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="rounded-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">{t("notifDeleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("notifDeleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
