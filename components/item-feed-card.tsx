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
import { ImagePlaceholder } from "@/components/image-placeholder";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ItemFeedCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  const thumb = item.images?.[0]?.image_url;
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");
  // Танҳо `thumb`-ро санҷидан кофӣ нест: URL метавонад мавҷуд бошад,
  // вале акс бор нашавад (404, файли нобудшуда). onError ин ҳолатро
  // мегирад ва ҷойгузинро нишон медиҳад.
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      href={`/items/${item.id}`}
      prefetch
      className="group flex flex-col gap-0 rounded-[1.125rem] bg-white dark:bg-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
    >
      {/* Акс аз ҳар чор тараф мудаввар — нишони навъ аз ин ҷо ба тугмаи
          поёнӣ кӯчид, пас кунҷи ботинии mask ва `-mb-px` дигар лозим нест. */}
      <div className="relative aspect-[4/3] rounded-[1.125rem] bg-zinc-100 dark:bg-zinc-700">
        {/* Placeholder ҲАМЕША дар таг аст, акс болои он мебарояд.
            Пеш аз ин он танҳо ҳангоми набудан/хатои акс нишон дода мешавад
            ва дар лаҳзаи БОРШАВӢ ҷои акс холии хокистарӣ мемонд. */}
        <ImagePlaceholder className="rounded-[1.125rem]" />
        {thumb && !imgFailed && (
          <Image
            src={thumb}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover rounded-[1.125rem]"
            onError={() => setImgFailed(true)}
          />
        )}
        {item.similarity_score !== undefined && (
          <span className="absolute top-2 left-2 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold bg-emerald-600 text-white">
            {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
          </span>
        )}
      </div>

      <div className="px-3 pt-2 pb-2.5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
            {item.title || item.category}
          </h3>
          <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {exactDate}
          </span>
        </div>

        {/* Ба ҷои тавсиф — навъи ашё ва тирча ҳамчун ЯК тугма.
            `span` аст, на `button`: тамоми корт аллакай `<a>` мебошад ва
            тугма дар дохили пайванд HTML-и нодуруст медиҳад. */}
        {/* Тугма аз ҳар чор тараф мудаввар, аз контент 4px васеътар (`-mx-1`),
            заминааш ҳамон фони барнома. Фосилаи болои он (`mt-1.5`) ва поёни он
            (`pb-2.5`-и контейнер) қасдан БАРОБАР нигоҳ дошта мешаванд.
            Соя дар доираи тирча аст, на дар худи тугма. */}
        <span className="mt-1.5 -mx-1 flex items-center justify-between gap-2 rounded-full bg-canvas p-0.5 pl-3">
          {/* Ранги навъ — сер, на хира: «Гумшуда» ва «Ёфтшуда» бояд аз як
              назар фарқ кунанд. Тобишҳои 700 дар заминаи `--canvas`
              контрасти WCAG AA-ро мегузаранд (500/600 не). */}
          <span
            className={cn(
              "min-w-0 truncate text-xs min-[1084px]:text-[13px] font-bold",
              item.type === "lost"
                ? "text-rose-700 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {item.type === "lost" ? t("lost") : t("found")}
          </span>
          <span className="shrink-0 grid place-items-center size-7 min-[1084px]:size-8 rounded-full bg-emerald-500 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.55)] dark:shadow-none">
            <ArrowRight className="w-[17px] h-[17px] min-[1084px]:w-[19px] min-[1084px]:h-[19px] text-white" />
          </span>
        </span>
      </div>
    </Link>
  );
}
