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
import { ItemDetailsSkeleton } from "@/components/item-details-skeleton";

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
      {/* Same skeleton as loading.tsx and the client's `!item` state — a
          different fallback here flashed a second skeleton layout. */}
      <Suspense fallback={<ItemDetailsSkeleton />}>
        <ItemDetailsClient id={id} initialItem={initialItem} />
      </Suspense>
    </>
  );
}
