/**
 * Ҷойгузини акс — вақте ки эълон акс НАДОРАД ё акс бор нашуд (404,
 * шабака, файли вайрон). Пеш аз ин дар чунин ҳолат танҳо росткунҷаи
 * холии хокистарӣ мемонд ва маълум набуд, ки ин хатост ё ҳанӯз боршуда
 * истодааст.
 *
 * `absolute inset-0` аст, чунки контейнери акс дар ҳама ҷо `relative`
 * ва бо `aspect-*` баландӣ мегирад.
 */
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700",
        className,
      )}
      aria-hidden
    >
      <ImageIcon className="w-10 h-10 min-[1084px]:w-14 min-[1084px]:h-14 text-zinc-400 dark:text-zinc-600" />
    </div>
  );
}
