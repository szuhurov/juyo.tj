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
      className="group flex flex-col gap-0 rounded-lg bg-white dark:bg-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
    >
      {/* Акс аз ҳар чор тараф мудаввар — нишони навъ аз ин ҷо ба тугмаи
          поёнӣ кӯчид, пас кунҷи ботинии mask ва `-mb-px` дигар лозим нест. */}
      <div className="relative aspect-[4/3] rounded-lg bg-zinc-100 dark:bg-zinc-700">
        {/* Placeholder ҲАМЕША дар таг аст, акс болои он мебарояд.
            Пеш аз ин он танҳо ҳангоми набудан/хатои акс нишон дода мешавад
            ва дар лаҳзаи БОРШАВӢ ҷои акс холии хокистарӣ мемонд. */}
        <ImagePlaceholder className="rounded-lg" />
        {thumb && !imgFailed && (
          <Image
            src={thumb}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover rounded-lg"
            onError={() => setImgFailed(true)}
          />
        )}
        {item.similarity_score !== undefined && (
          <span className="absolute top-2 left-2 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold bg-emerald-600 text-white">
            {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
          </span>
        )}
      </div>

      {/* Талаби корбар: қисми поёни корт (зери акс) ~10-15% паст шавад, вале
          унвон/сана даст нахӯранд — пас танҳо padding/margin кам шуд, на
          андозаи матн. Акс низ даст нахӯрд: `aspect-[4/3]` бетағйир аст. */}
      <div className="px-3 pt-1 pb-1 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
            {item.title || item.category}
          </h3>
          <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {exactDate}
          </span>
        </div>

        {/* Тавсиф — ЯК сатр, хокистарӣ ва хурдтар аз унвон, то иерархия
            вайрон нашавад. `truncate` ҳатмист: баландии корт дар grid бояд
            новобаста аз дарозии матн якхела монад. Матн ҳангоми нашр аллакай
            аз рақамҳои ҳуҷҷат тоза шудааст (`stripDocumentNumbers` дар
            саҳифаи `items/add`), пас ин ҷо филтр лозим нест. */}
        {item.description && (
          <p className="-mt-0.5 truncate text-[11px] min-[1084px]:text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {item.description}
          </p>
        )}

        {/* Ба ҷои тавсиф — навъи ашё ва тирча ҳамчун ЯК тугма.
            `span` аст, на `button`: тамоми корт аллакай `<a>` мебошад ва
            тугма дар дохили пайванд HTML-и нодуруст медиҳад. */}
        {/* Тугма аз ҳар чор тараф мудаввар, аз контент 4px васеътар (`-mx-1`),
            заминааш ҳамон фони барнома. Талаби корбар: гӯшаҳои тугма аз
            гӯшаҳои худи корт КАМТАР мудаввар (rounded-md, на rounded-lg),
            каме фосила аз тавсиф (`mt-0.5`) ва аз лаби корт (`mb-0.5`).
            Соя дар доираи тирча аст, на дар худи тугма. */}
        <span className="-mx-1 mt-0.5 mb-0.5 flex items-center justify-between gap-2 rounded-md bg-canvas p-0.5 pl-2.5">
          {/* Ранги навъ — сер, на хира: «Гумшуда» ва «Ёфтшуда» бояд аз як
              назар фарқ кунанд. Тобишҳои 700 дар заминаи `--canvas`
              контрасти WCAG AA-ро мегузаранд (500/600 не).
              Андоза — талаби корбар: аз унвон хурдтар, аз тавсиф калонтар
              (унвон text-sm/base, тавсиф text-[11px]/xs). */}
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
          <span className="shrink-0 grid place-items-center size-6 min-[1084px]:size-7 rounded-full bg-emerald-500 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.55)] dark:shadow-none">
            <ArrowRight className="w-[15px] h-[15px] min-[1084px]:w-[17px] min-[1084px]:h-[17px] text-white" />
          </span>
        </span>
      </div>
    </Link>
  );
}
