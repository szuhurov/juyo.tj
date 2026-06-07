/**
 * Ин саҳифаи тафсилоти эълон ҳаст (Item View).
 * Барои SEO ва Share дар Telegram/WhatsApp, Metadata дар сервер сохта мешавад.
 */

import { Metadata } from "next";
import { ItemService } from "@/lib/services/item-service";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";
import ItemDetailsClient from "./item-details-client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Генератсияи Metadata дар сервер барои Telegram, WhatsApp ва SEO.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const item = await ItemService.getItemDetails(id);
    if (!item) return { title: "JUYO.TJ" };

    const cookieStore = await cookies();
    const locale = cookieStore.get("juyo-locale")?.value || "tg";
    const t = (translations as any)[locale] || translations.tg;

    const typeText = item.type === 'lost' ? t.lost : t.found;
    const title = `${typeText}: ${item.title} | JUYO.TJ`;
    const description = item.description?.substring(0, 160) || t.seoDesc;
    const imageUrl = item.images?.[0]?.image_url || "https://juyo.tj/logo.png";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://juyo.tj/items/${id}`,
        siteName: "juyo",
        images: [
          {
            url: imageUrl,
            width: 1200, // Андозаи стандартӣ барои WhatsApp/Telegram
            height: 630,
            alt: title,
          }
        ],
        type: "article", // Барои эълонҳо беҳтар аст
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (e) {
    return { title: "JUYO.TJ" };
  }
}

function ItemDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
        <div className="sticky top-0 md:top-24 z-0 w-full p-0">
          <Skeleton className="aspect-square w-full rounded-none md:rounded-[32px]" />
        </div>
        <div className="flex flex-col bg-white dark:bg-zinc-950 rounded-t-[2.5rem] md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-24 w-full rounded-2xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ItemDetailsPage({ params }: Props) {
  const { id } = await params;

  // Server-side fetch: anon client (танҳо approved item-ҳоро мебинад)
  // Ин барои Google crawler аст — мӯҳтавои саҳифа дар HTML аввалия мавҷуд аст
  let initialItem = null;
  let jsonLd: object | null = null;
  try {
    initialItem = await ItemService.getItemDetails(id);
    if (initialItem) {
      const cookieStore = await cookies();
      const locale = cookieStore.get("juyo-locale")?.value || "tg";
      const t = (translations as any)[locale] || translations.tg;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": `${initialItem.type === 'lost' ? t.lost : t.found}: ${initialItem.title}`,
        "description": initialItem.description?.substring(0, 200),
        "url": `https://juyo.tj/items/${id}`,
        "datePublished": initialItem.created_at,
        "image": initialItem.images?.[0]?.image_url || "https://juyo.tj/logo.png",
        "isPartOf": { "@id": "https://juyo.tj/#website" },
      };
    }
  } catch {
    // Structured data ихтиёрӣ аст — хатогӣ рендерро манъ намекунад
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetailsClient id={id} initialItem={initialItem} />
      </Suspense>
    </>
  );
}
