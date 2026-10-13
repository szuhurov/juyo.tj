/**
 * Admin statistics added by migration 20261013000000_client_stats: the app
 * platform of a user and the source of a listing. Until that migration is
 * applied the columns do not exist — every read here is separate from the
 * main query and simply returns nothing, so the panel keeps working.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemSource = "web" | "app" | "instagram" | "telegram" | "admin";

export const SOURCE_LABELS: Record<ItemSource | "unknown", string> = {
  app: "Барнома",
  web: "Сайт",
  instagram: "Instagram",
  telegram: "Telegram",
  admin: "Админ",
  unknown: "Номаълум",
};

export const PLATFORM_LABELS: Record<string, string> = { android: "Android", ios: "iPhone" };

export interface AppClientInfo {
  app_platform: string | null;
  app_version: string | null;
  app_first_seen_at: string | null;
  app_last_seen_at: string | null;
}

/** App info of these users, by id. Empty when the columns are not there yet. */
export async function appInfoByUser(db: SupabaseClient, userIds: string[]): Promise<Map<string, AppClientInfo>> {
  const out = new Map<string, AppClientInfo>();
  if (userIds.length === 0) return out;
  const { data, error } = await db
    .from("profiles")
    .select("id, app_platform, app_version, app_first_seen_at, app_last_seen_at")
    .in("id", userIds);
  if (error) return out;
  for (const row of data ?? []) out.set(row.id, row as AppClientInfo);
  return out;
}

/** Source of these listings, by id. Empty when the column is not there yet. */
export async function sourceByItem(db: SupabaseClient, itemIds: string[]): Promise<Map<string, ItemSource | null>> {
  const out = new Map<string, ItemSource | null>();
  if (itemIds.length === 0) return out;
  const { data, error } = await db.from("items").select("id, source").in("id", itemIds);
  if (error) return out;
  for (const row of data ?? []) out.set(row.id, (row.source as ItemSource | null) ?? null);
  return out;
}

/**
 * Inserts a listing with its `source`; if the database does not have the
 * column yet (the website and the app ship separately from the migration),
 * the same listing is inserted without it.
 */
export async function insertItemWithSource<T extends Record<string, unknown>>(
  insert: (row: T & { source?: ItemSource }) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
  row: T,
  source: ItemSource,
) {
  const first = await insert({ ...row, source });
  const missingColumn = first.error && (first.error.code === "PGRST204" || /source/.test(first.error.message ?? ""));
  return missingColumn ? insert(row) : first;
}
