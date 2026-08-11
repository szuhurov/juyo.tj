"use client";

/**
 * Филтрҳоро дар URL нигоҳ медорад, на дар `useState`.
 *
 * Сабаб: бо `useState` кофист, ки корбар ба саҳифаи дохилӣ (эълон, корбар)
 * гузарад ва баргардад — ҳамаи филтрҳо ва рақами саҳифа ба ҳолати аввал
 * бармегаштанд. Ҳамин хатогӣ дар саҳифаи асосии сайт низ буд ва бо ҳамин
 * усул ҳал шуд. Иловатан URL акнун мубодилашаванда мешавад.
 */

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterValue = string | number | undefined;

// `T` бе маҳдудияти `Record<...>` — интерфейсҳои воқеӣ (AdminPostFilters ва
// ғ.) index signature надоранд ва ба он шарт мувофиқ намеоянд.
export function useUrlFilters<T>({
  keys,
  numericKeys = [],
  defaults,
}: {
  /** Ҳамаи калидҳое, ки дар URL нигоҳ дошта мешаванд. */
  keys: readonly string[];
  /** Кадоми онҳо рақаманд (масалан `page`). */
  numericKeys?: readonly string[];
  /** Қиматҳое, ки дар URL нестанд (масалан `pageSize`-и собит). */
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
    // `defaults`/`keys` дар ҳар render объекти нав месозанд — вобастагӣ
    // танҳо ба searchParams аст, ки сарчашмаи ҳақиқат мебошад.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilters = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      const record = next as Record<string, FilterValue>;
      for (const key of keys) {
        const value = record[key];
        // 0 қимати эътибории `page` аст — `!value` онро мепартофт.
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      // ҲАЛҚАИ БЕПОЁН — муҳофизати ҳатмӣ. Бе ин, `router.replace` объекти
      // нави `searchParams` месозад → `setFilters` шахсияти нав мегирад →
      // effect-и даъваткунанда аз нав кор мекунад → боз `replace`.
      const qs = params.toString();
      if (qs === searchParams.toString()) return;

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, router, pathname],
  );

  return { filters, setFilters };
}
