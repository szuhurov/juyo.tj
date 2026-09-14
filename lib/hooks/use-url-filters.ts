"use client";

/**
 * Keeps filters in the URL instead of in `useState`.
 *
 * Reason: with `useState`, it's enough for the user to navigate to an inner
 * page (a post, a user) and come back — all filters and the page number
 * would reset to their initial state. This exact bug also occurred on the
 * site's main page and was fixed the same way. Additionally, the URL is now shareable.
 */

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterValue = string | number | undefined;

// `T` without a `Record<...>` constraint — real interfaces (AdminPostFilters,
// etc.) have no index signature and wouldn't satisfy that constraint.
export function useUrlFilters<T>({
  keys,
  numericKeys = [],
  defaults,
}: {
  /** All keys that are kept in the URL. */
  keys: readonly string[];
  /** Which of them are numeric (e.g. `page`). */
  numericKeys?: readonly string[];
  /** Values that aren't in the URL (e.g. a fixed `pageSize`). */
  defaults?: Partial<T>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const result: Record<string, FilterValue> = { ...defaults };
    for (const key of keys) {
      const raw = searchParams.get(key);
      if (raw === null || raw === "") continue;
      result[key] = numericKeys.includes(key) ? Number(raw) : raw;
    }
    return result as T;
    // `defaults`/`keys` create a new object on every render — the only
    // real dependency is searchParams, which is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilters = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      const record = next as Record<string, FilterValue>;
      for (const key of keys) {
        const value = record[key];
        // 0 is a valid value for `page` — `!value` would have dropped it.
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      // INFINITE LOOP — this guard is mandatory. Without it, `router.replace`
      // creates a new `searchParams` object → `setFilters` gets a new
      // identity → the calling effect runs again → `replace` again.
      const qs = params.toString();
      if (qs === searchParams.toString()) return;

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, router, pathname],
  );

  return { filters, setFilters };
}
