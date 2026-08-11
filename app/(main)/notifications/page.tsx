/**
 * Саҳифаи пурраи огоҳиномаҳо — эълонҳои нав дар категорияҳои корбар.
 * Ҳар сатр на ба саҳифаи эълон мегузарад, балки дар ҳамин ҷо кушода
 * мешавад (аксаи эълон + пайванди "Дидани эълон"). Сатрҳои нодидашуда
 * рангашон фарқ мекунад; кушодани сатр ранги ҳамон сатрро ба ҳолати одӣ мегузаронад.
 * Ҳар сатрро бо ангушт ба чап/рост кашидан пурра нест мекунад (swipe-to-delete).
 */
"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, type NotificationItem } from "@/lib/hooks/use-notifications";
import { ClaimantAvatar } from "@/components/claimant-avatar";
import { Bell, BellRing, ChevronDown, ArrowRight, Trash2, CheckCheck, CheckSquare, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useWebPush } from "@/lib/hooks/use-web-push";

const SWIPE_THRESHOLD = 90;

function NotificationRow({
  item,
  unread,
  expanded,
  selected,
  onToggle,
  onDelete,
  onDeleteClick,
  t,
}: {
  item: NotificationItem;
  unread: boolean;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDeleteClick: () => void;
  t: (key: string) => string;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX;
    draggedRef.current = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 8) {
      draggedRef.current = true;
      setIsDragging(true);
    }
    if (draggedRef.current) setDragX(delta);
  };

  const handlePointerUp = () => {
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      onDelete();
    } else {
      setDragX(0);
    }
    setIsDragging(false);
    startXRef.current = null;
    // draggedRef то баъд аз click-и навбатӣ true мемонад, то toggleExpand
    // ҳангоми раҳо кардани ангушт пас аз swipe фаъол нашавад.
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const handleClick = () => {
    if (draggedRef.current) return;
    onToggle();
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl bg-red-600 flex items-center px-6 pointer-events-none"
        style={{
          justifyContent: dragX >= 0 ? "flex-start" : "flex-end",
          opacity: dragX === 0 ? 0 : Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1),
        }}
      >
        <Trash2 className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-white" />
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          opacity: 1 - Math.min(Math.abs(dragX) / 260, 0.7),
        }}
        className={cn(
          "relative z-10 rounded-2xl border overflow-hidden touch-pan-y",
          !isDragging && "transition-[transform,opacity] duration-200",
          selected && "ring-2 ring-emerald-500",
          unread
            ? "bg-white dark:bg-zinc-800 border-emerald-200 dark:border-emerald-900/50"
            : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800",
        )}
      >
        <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="relative shrink-0">
          <ClaimantAvatar url={item.posterAvatar ?? null} name={item.posterName ?? null} className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 text-sm min-[1084px]:text-base" />
          {selected && (
            <CheckCircle2 className="absolute -bottom-1 -right-1 w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-emerald-500 bg-white dark:bg-zinc-800 rounded-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm min-[1084px]:text-base font-bold text-zinc-800 dark:text-zinc-200">
              {item.itemTitle}
            </p>
            {item.itemType && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] min-[1084px]:text-[10px] min-[1920px]:text-[11px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
                  item.itemType === "lost"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {item.itemType === "lost" ? t("lost") : t("found")}
              </span>
            )}
          </div>
          <p className="text-[10px] min-[1084px]:text-[11px] min-[1920px]:text-xs text-zinc-400 dark:text-zinc-500 font-bold mt-1">
            {format(new Date(item.createdAt), "dd.MM.yyyy HH:mm")}
          </p>
        </div>
        {unread && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
        <ChevronDown
          className={cn(
            "w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5 text-zinc-400 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3.5">
          {item.itemImageUrl && (
            <div className="relative w-full h-40 min-[1084px]:h-48 min-[1920px]:h-56 rounded-xl overflow-hidden mb-3">
              <Image
                src={item.itemImageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Link
              href={`/items/${item.itemId}`}
              className="flex-1 flex items-center justify-center gap-2 h-11 min-[1084px]:h-12 min-[1920px]:h-[52px] rounded-xl bg-emerald-500 text-white font-bold text-xs min-[1084px]:text-sm shadow-sm hover:shadow-md transition-all"
            >
              {item.itemTitle}
              <ArrowRight className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick();
              }}
              className="h-11 w-11 min-[1084px]:h-12 min-[1084px]:w-12 min-[1920px]:h-[52px] min-[1920px]:w-[52px] shrink-0 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { items, loading, markOpened, markAllOpened, isOpened, dismissNotification } = useNotifications({
    categoryLimit: 100,
  });
  const { status, subscribed, subscribe, unsubscribe } = useWebPush();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);

  const handleDelete = async (item: NotificationItem) => {
    try {
      await dismissNotification(item);
    } catch {
      toast.error(t("error"));
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
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="sticky top-12 sm:top-16 z-30 bg-canvas py-3 mb-4 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <Bell className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 text-zinc-500 dark:text-zinc-400 shrink-0" />
        <h1 className="flex-1 text-base min-[1084px]:text-lg min-[1920px]:text-xl font-bold tracking-tight text-zinc-500 dark:text-zinc-400 ml-1">
          {t("notifPageTitle")}
        </h1>
        {items.length > 0 && !selectMode && (
          <>
            <button
              type="button"
              onClick={markAllOpened}
              aria-label={t("notifMarkAllRead")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <CheckCheck className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              aria-label={t("notifSelectAll")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              aria-label={t("notifDeleteAll")}
              className="h-9 w-9 min-[1084px]:h-10 min-[1084px]:w-10 shrink-0 rounded-lg flex items-center justify-center text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-[18px] h-[18px] min-[1084px]:w-5 min-[1084px]:h-5" />
            </button>
          </>
        )}
      </div>

      {status !== "unsupported" && (
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <BellRing className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 text-zinc-500 dark:text-zinc-400 shrink-0" />
          <span className="flex-1 text-sm min-[1084px]:text-base min-[1920px]:text-[17px] font-bold text-zinc-500 dark:text-zinc-400">
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

      {/* Рӯйхат */}
      {loading ? (
        // Геометрия бо NotificationRow як хел: ҳамон rounded-2xl, ҳамон
        // p-4, ҳамон андозаи аватар ва сатрҳо — то ҳангоми омадани
        // маълумот рӯйхат наҷаҳад.
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_6px_14px_-4px_rgba(15,23,42,0.10)] dark:shadow-none p-4 flex items-center gap-3"
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
        <div className="py-20 text-center text-sm min-[1084px]:text-base font-medium text-zinc-400">{t("notifEmpty")}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              unread={!isOpened(item.id)}
              expanded={expandedId === item.id}
              selected={selectMode}
              onToggle={() => toggleExpand(item)}
              onDelete={() => handleDelete(item)}
              onDeleteClick={() => handleDelete(item)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
