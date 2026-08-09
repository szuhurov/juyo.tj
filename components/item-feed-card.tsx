"use client";

/**
 * Card-и ашё барои feed-и саҳифаи асосӣ (2 дар як қатор, на list). Аз
 * ItemCard/ItemListRow фарқ мекунад: type+share дар рӯи акс, унвон+мукофот
 * дар як сатр, description, ва дар охир сана + icon-и "даромадан". Услуб —
 * product-card (акси inset бо padding, соя-и мулоим, rounded калон).
 */
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { UNSPECIFIED_REWARD, type Item } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export function ItemFeedCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  const thumb = item.images?.[0]?.image_url;
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareData = {
      title: item.title,
      text: item.description,
      url: `${window.location.origin}/items/${item.id}`,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (typeof window !== "undefined" && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "SHARE", payload: shareData }),
      );
    } else {
      navigator.clipboard.writeText(shareData.url);
      toast.success(t("success"));
    }
  };

  return (
    <Link
      href={`/items/${item.id}`}
      prefetch
      className="flex flex-col gap-2 rounded-[1.125rem] p-2 bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:to-emerald-800/70 shadow-[0_1px_2px_rgba(5,150,105,0.09),0_9px_20px_rgba(5,150,105,0.16),0_18px_36px_-14px_rgba(5,150,105,0.21)] dark:shadow-none dark:border dark:border-emerald-900/30 overflow-hidden"
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {thumb && (
          <Image
            src={thumb}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
        <span
          className={cn(
            "absolute top-2 left-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] min-[1084px]:text-xs min-[1503px]:text-sm font-black shadow-lg",
            item.type === "lost" ? "bg-red-600 text-white" : "bg-[#0eab7a] text-white",
          )}
        >
          {item.type === "lost" ? t("lost") : t("found")}
        </span>
        {item.similarity_score !== undefined && (
          <span className="absolute top-2 left-2 mt-8 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black shadow-md bg-emerald-600 text-white">
            {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
          </span>
        )}
        <button
          type="button"
          onClick={handleShare}
          aria-label={t("share")}
          className="absolute top-2 right-2 w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1503px]:w-9 min-[1503px]:h-9 flex items-center justify-center rounded-full bg-white text-zinc-700 shadow-lg hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1503px]:w-[18px] min-[1503px]:h-[18px]" />
        </button>
      </div>

      <div className="px-1 pb-1 flex flex-col flex-1 gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-extrabold text-[15px] min-[1084px]:text-base min-[1503px]:text-lg text-zinc-900 dark:text-zinc-100">
            {item.title || item.category}
          </h3>
          <span className="shrink-0 text-[11px] min-[1084px]:text-xs min-[1503px]:text-sm font-bold text-zinc-400 dark:text-zinc-500">
            {exactDate}
          </span>
        </div>

        {item.description && (
          <p className="text-[11px] min-[1084px]:text-xs min-[1503px]:text-sm text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        <span className="mt-auto translate-y-0.5 flex items-center justify-between gap-2 rounded-full pl-2.5 pr-1 py-1 min-[1084px]:py-1.5 bg-emerald-100 dark:bg-emerald-950/40 shadow-sm">
          <span className="min-w-0 flex items-center gap-1 text-[11px] min-[1084px]:text-xs min-[1503px]:text-sm font-black text-emerald-700 dark:text-emerald-400">
            {item.reward === UNSPECIFIED_REWARD ? (
              <span className="min-w-0 truncate">{t("reward_unspecified_viewer")}</span>
            ) : item.reward ? (
              <span className="min-w-0 truncate">{`${t("reward_gives_viewer")} ${item.reward} TJS`}</span>
            ) : (
              <span className="min-w-0 truncate">{t("moreInfoViewer")}</span>
            )}
          </span>
          <span className="shrink-0 w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1503px]:w-7 min-[1503px]:h-7 flex items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
            <ArrowRight className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 min-[1503px]:w-4 min-[1503px]:h-4 text-white" />
          </span>
        </span>
      </div>
    </Link>
  );
}
