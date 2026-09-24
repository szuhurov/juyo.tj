/**
 * This is the item details page (Item View).
 * Metadata is generated on the server for SEO and sharing on Telegram/WhatsApp.
 */

import { Metadata } from "next";
import { cache } from "react";
import { ItemService } from "@/lib/services/item-service";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";
import ItemDetailsClient from "./item-details-client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const getItemCached = cache((id: string) => ItemService.getItemDetails(id));

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Server-side metadata generation for Telegram, WhatsApp, and SEO.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const item = await getItemCached(id);
    if (!item) return { title: "JUYO.TJ" };

    const cookieStore = await cookies();
    const locale = cookieStore.get("juyo-locale")?.value || "tg";
    const t = translations[locale] || translations.tg;

    const typeText = item.type === 'lost' ? t.lost : t.found;
    const title = `${item.title} — ${typeText} | juyo.tj`;
    const description = item.description?.substring(0, 160) || (t.seoDesc as string);
    const imageUrl = item.images?.[0]?.image_url || "https://juyo.tj/juyo-logo.jpg";

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
            width: 1200, // Standard size for WhatsApp/Telegram
            height: 630,
            alt: title,
          }
        ],
        type: "article", // Better suited for listings
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "JUYO.TJ" };
  }
}

function ItemDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 mx-auto max-w-6xl md:pt-8 md:px-4 -mb-20 pb-20 md:mb-0 md:pb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
        <div className="sticky top-0 md:top-24 z-0 w-full p-0">
          <Skeleton className="aspect-square w-full rounded-none md:rounded-md" />
        </div>
        <div className="flex flex-col bg-white dark:bg-zinc-950 rounded-t-3xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100 dark:border-zinc-800">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-24 w-full rounded-md mb-8" />
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

  // Server-side fetch: anon client (only sees approved items)
  // This is for the Google crawler — the page content is present in the initial HTML
  let initialItem = null;
  let jsonLd: object | null = null;
  try {
    initialItem = await getItemCached(id);
    if (initialItem) {
      const cookieStore = await cookies();
      const locale = cookieStore.get("juyo-locale")?.value || "tg";
      const t = translations[locale] || translations.tg;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": `${initialItem.title} — ${initialItem.type === 'lost' ? t.lost : t.found} | juyo.tj`,
        "description": initialItem.description?.substring(0, 200),
        "url": `https://juyo.tj/items/${id}`,
        "datePublished": initialItem.created_at,
        "image": initialItem.images?.[0]?.image_url || "https://juyo.tj/juyo-logo.jpg",
        "isPartOf": { "@id": "https://juyo.tj/#website" },
      };
    }
  } catch {
    // Structured data is optional — an error here doesn't block rendering
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
