/**
 * Ҷойгузини акс — се ҳолатро мепӯшонад: эълон акс НАДОРАД, акс бор
 * нашуд (404, шабака, файли вайрон), ва акс ҳанӯз БОР ШУДА ИСТОДААСТ.
 *
 * Ҳолати сеюм муҳим аст: он ҳамчун қабати ТАГ гузошта мешавад ва акс
 * болои он мебарояд. Пеш аз ин placeholder алтернативаи акс буд, пас
 * дар лаҳзаи боршавӣ ҷои акс росткунҷаи холии хокистарӣ мемонд.
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
