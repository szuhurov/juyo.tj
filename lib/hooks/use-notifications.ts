"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const TOAST_REMIND_MS = 60 * 60 * 1000; // Такрори ёдоварии toast, агар корбар ҳанӯз надида бошад
const SEEN_STORAGE_KEY = "juyo_seen_notification_ids";
const OPENED_STORAGE_KEY = "juyo_opened_notification_ids";
const TOAST_SHOWN_STORAGE_KEY = "juyo_toast_last_shown";

export interface NotificationItem {
  /** `expiry_confirm` — то нест шудани эълони ХУДИ корбар 72 соат мондааст
   *  ва ӯ бояд «ҳанӯз лозим» ё «не» гӯяд. Ҷадвали алоҳида надорад: мисли
   *  `category_post` аз худи маълумот ҳисоб мешавад. */
  kind: "category_post" | "expiry_confirm";
  id: string;
  itemId: string;
  itemTitle: string;
  itemImageUrl: string | null;
  itemType?: "lost" | "found" | null;
  createdAt: string;
  posterName?: string | null;
  posterAvatar?: string | null;
  /** Танҳо барои `expiry_confirm` — лаҳзаи несткунӣ (`items.expires_at`). */
  expiryDeadline?: string;
}

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

// Вақти охирини нишон додани toast барои ҳар ID — дар localStorage, то
// ҳангоми reload/remount-и компонент гум нашавад (ана ҳамин боис буд, ки
// toast ҳар 20 сония такрор мешуд).
function loadToastTimestamps(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(TOAST_SHOWN_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveToastTimestamps(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOAST_SHOWN_STORAGE_KEY, JSON.stringify(map));
}

export function useNotifications(options: { categoryLimit?: number } = {}) {
  const { categoryLimit = 20 } = options;
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // seenIds — назорати рақами badge-и занг (якбора, ҳангоми click ба занг).
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadIds(SEEN_STORAGE_KEY));
  // openedIds — назорати ранги ҳар сатр дар рӯйхат (алоҳида, ҳангоми кушодани ҳамон сатр).
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => loadIds(OPENED_STORAGE_KEY));
  // Вақти охирини нишондодашудаи toast барои ҳар ID (localStorage-based, на
  // useRef) — то ҳангоми remount-и компонент (масалан гузариш байни
  // саҳифаҳо) toast-и якхела ҳар 20 сония такрор нашавад.
  const toastShownAt = useRef<Record<string, number>>(loadToastTimestamps());

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = await getToken({ template: "supabase" });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);

    // get_my_category_notifications — эълонҳои нави дигар корбарон дар
    // ҳамон категорияҳое, ки худи корбар низ эълон дорад.
    const { data: catData } = await supabase.rpc("get_my_category_notifications", { p_limit: categoryLimit });

    interface CategoryNotificationRow {
      item_id: string;
      item_title: string | null;
      item_image_url: string | null;
      created_at: string;
      poster_first_name: string | null;
      poster_last_name: string | null;
      poster_avatar_url: string | null;
      item_type?: "lost" | "found" | null;
    }

    const rows: NotificationItem[] = (catData ?? []).map((row: CategoryNotificationRow) => ({
      id: `category:${row.item_id}`,
      kind: "category_post" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: row.item_image_url ?? null,
      itemType: row.item_type ?? null,
      createdAt: row.created_at,
      posterName: `${row.poster_first_name ?? ""} ${row.poster_last_name ?? ""}`.trim() || null,
      posterAvatar: row.poster_avatar_url ?? null,
    }));

    // Эълонҳои ХУДИ корбар, ки огоҳии «72 соат мондааст» гирифтаанд ва ҳанӯз
    // нест нашудаанд. Ду шарт ду маъно доранд:
    //   expiry_notified_at не-холӣ  → огоҳинома рафтааст (лаҳзаи ГУЗАШТА)
    //   expires_at > ҳозир          → ҳанӯз зинда аст (лаҳзаи ОЯНДА)
    // RLS кифоя аст — корбар сатрҳои худро мебинад, `supabaseAdmin` лозим нест.
    const { data: expiring } = await supabase
      .from("items")
      .select("id, title, expires_at, expiry_notified_at, type, item_images(image_url)")
      .eq("user_id", userId)
      .not("expiry_notified_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });

    interface ExpiringRow {
      id: string;
      title: string | null;
      expires_at: string;
      expiry_notified_at: string;
      type?: "lost" | "found" | null;
      item_images?: { image_url: string }[] | null;
    }

    const expiryRows: NotificationItem[] = (expiring ?? []).map((row: ExpiringRow) => ({
      id: `expiry:${row.id}`,
      kind: "expiry_confirm" as const,
      itemId: row.id,
      itemTitle: row.title ?? "",
      itemImageUrl: row.item_images?.[0]?.image_url ?? null,
      itemType: row.type ?? null,
      // Дар рӯйхат вақти ОМАДАНИ огоҳинома нишон дода мешавад…
      createdAt: row.expiry_notified_at,
      // …вале ҳисоби «чанд соат мондааст» аз лаҳзаи НЕСТКУНӢ меояд.
      expiryDeadline: row.expires_at,
    }));

    // Огоҳии несткунӣ ҲАМЕША дар боло — вақташ маҳдуд аст (72 соат), дар ҳоле
    // ки эълонҳои категория метавонанд интизор шаванд.
    const merged = [...expiryRows, ...rows];

    // Toast барои ҳар ID танҳо якбор фавран мебарояд, баъд on то 1 соат
    // такрор намешавад — ва агар корбар аллакай онро дида бошад (seenIds),
    // дигар ҳаргиз такрор намешавад, танҳо огоҳиномаҳои воқеан НАВ мебароянд.
    const now = Date.now();
    const timestamps = toastShownAt.current;
    let timestampsChanged = false;
    for (const r of merged) {
      if (seenIds.has(r.id)) continue;
      const lastShown = timestamps[r.id];
      if (lastShown && now - lastShown < TOAST_REMIND_MS) continue;
      toast.info(
        r.kind === "expiry_confirm"
          ? t("expiryToast").replace("%{title}", r.itemTitle)
          : t("categoryPostToast").replace("%{title}", r.itemTitle),
      );
      timestamps[r.id] = now;
      timestampsChanged = true;
    }
    if (timestampsChanged) saveToastTimestamps(timestamps);

    setItems(merged);
    setLoading(false);
  }, [userId, getToken, t, categoryLimit, seenIds]);

  useEffect(() => {
    // Боркунии аввалия ҳангоми mount/иваз шудани userId — дар дохили
    // fetchAll шохаи "корбар нест" пеш аз await state-ро синхронӣ иваз
    // мекунад, ки барои эффекти боркунии маълумот коррект аст.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    if (!userId) return;
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchAll]);

  // Вақте ки корбар ба занг click мекунад, ҳамаи огоҳиномаҳои ҳозираро
  // "дида шуд" мегузорем — рақами badge то дархости воқеан нав пайдо
  // нашуда, боз намепайдояд.
  const markAllSeen = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  // Вақте ки як сатри мушаххас дар рӯйхат кушода мешавад — танҳо ранги
  // ҲАМОН сатр ба ҳолати одӣ мегузарад (аз badge-и умумӣ ҷудо).
  const markOpened = useCallback((id: string) => {
    setOpenedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(OPENED_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, []);

  // Ҳамаи сатрҳои ҳозираро якбора "хондашуда" мегузорад (тугмаи
  // "Ҳамаро хондашуда қайд кунед").
  const markAllOpened = useCallback(() => {
    setOpenedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(OPENED_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  const count = items.filter((item) => !seenIds.has(item.id)).length;
  const isOpened = useCallback((id: string) => openedIds.has(id), [openedIds]);

  // Нест кардани як огоҳинома аз рӯйхати корбар — dismiss_notification RPC
  // ҳамзамон дар dismissed_notifications (то дигар барнагардад) ва
  // deleted_notifications_archive (барои admin) сабт мекунад.
  const dismissNotification = useCallback(
    async (item: NotificationItem) => {
      // Огоҳии мӯҳлатро пинҳон кардан МУМКИН НЕСТ: пинҳон шуданаш эълонро
      // наҷот намедиҳад — cron ба ҳар ҳол баъд аз 72 соат онро нест мекунад.
      // Корбар бояд «Истодааст» ё «Не»-ро интихоб кунад.
      if (item.kind === "expiry_confirm") return;

      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const refId = item.id.includes(":") ? item.id.split(":")[1] : item.id;
      const { error } = await supabase.rpc("dismiss_notification", {
        p_kind: item.kind,
        p_ref_id: refId,
        p_item_id: item.itemId,
        p_item_title: item.itemTitle,
        p_related_name: item.posterName ?? null,
        p_related_avatar: item.posterAvatar ?? null,
        p_status: null,
      });
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [getToken],
  );

  /** Ҷавоби соҳиб ба огоҳии мӯҳлат. `keep` — боз як давра, `delete` — фавран
   *  нест. Route худаш соҳибиро аз рӯи база месанҷад. */
  const respondToExpiry = useCallback(
    async (item: NotificationItem, action: "keep" | "delete") => {
      const token = await getToken();
      const res = await fetch(`/api/items/${item.itemId}/expiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // Рӯйхати эълонҳо дигар шуд — саҳифаҳои кушода бояд навсозӣ шаванд.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("items-updated"));
      }
    },
    [getToken],
  );

  return { items, count, loading, refetch: fetchAll, markAllSeen, markOpened, markAllOpened, isOpened, dismissNotification, respondToExpiry };
}
