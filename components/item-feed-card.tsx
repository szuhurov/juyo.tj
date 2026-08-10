"use client";

/**
 * Card-и ашё барои feed-и саҳифаи асосӣ (2 дар як қатор, на list). Аз
 * ItemCard/ItemListRow фарқ мекунад: type+share дар рӯи акс, унвон+мукофот
 * дар як сатр, description, ва дар охир сана + icon-и "даромадан". Услуб —
 * product-card (акси inset бо padding, соя-и мулоим, rounded калон).
 */
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { type Item } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export function ItemFeedCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  const thumb = item.images?.[0]?.image_url;
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");

  return (
    <Link
      href={`/items/${item.id}`}
      prefetch
      className="flex flex-col gap-0 rounded-[1.125rem] bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:to-emerald-800/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
    >
      <div className="relative aspect-[4/3] -mb-px rounded-t-[1.125rem] bg-zinc-100 dark:bg-zinc-800">
        {thumb && (
          <Image
            src={thumb}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover rounded-t-[1.125rem]"
          />
        )}
        <span
          className={cn(
            "absolute -bottom-1.5 right-0 inline-flex items-end leading-none rounded-none rounded-tl-lg px-3 pt-1.5 pb-0 text-xs min-[1084px]:text-sm font-bold bg-white dark:bg-zinc-900",
            item.type === "lost"
              ? "text-rose-700 dark:text-rose-400"
              : "text-green-700 dark:text-green-400",
          )}
        >
          {/* Кунҷи БОТИНӢ (concave) дар чапи badge: хати сафед ҳангоми
              ба боло гаштан набояд якбора 90° шиканад. Бо border-radius
              ин шакл ҳосил намешавад — квадрати сафед бо mask бурида
              мешавад, то чоряк-доира аз кунҷи болои-чапаш холӣ монад. */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-[calc(100%-1px)] h-6 w-6 bg-white dark:bg-zinc-900"
            style={{
              WebkitMaskImage:
                "radial-gradient(circle at 0 0, transparent 23px, black 25px)",
              maskImage:
                "radial-gradient(circle at 0 0, transparent 23px, black 25px)",
            }}
          />
          {item.type === "lost" ? t("lost") : t("found")}
        </span>
        {item.similarity_score !== undefined && (
          <span className="absolute top-2 left-2 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold bg-emerald-600 text-white">
            {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
          </span>
        )}
      </div>

      <div className="px-3 pt-2 pb-3 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-zinc-100">
            {item.title || item.category}
          </h3>
          <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {exactDate}
          </span>
        </div>

        {item.description && (
          <div className="relative mt-auto">
            <p className="text-[11px] min-[1084px]:text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-snug pr-8">
              {item.description}
            </p>
            <span className="absolute bottom-0 right-0 w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 flex items-center justify-center rounded-full bg-emerald-500">
              <ArrowRight className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] text-white" />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
