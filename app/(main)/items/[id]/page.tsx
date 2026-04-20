/**
 * Ин саҳифаи тафсилоти эълон ҳаст (Item View).
 * Барои SEO ва Share дар Telegram/WhatsApp, Metadata дар сервер сохта мешавад.
 */

import { Metadata } from "next";
import { ItemService } from "@/lib/services/item-service";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";
import ItemDetailsClient from "./item-details-client";

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
    const imageUrl = item.images?.[0]?.image_url || "https://juyo.tj/logo.jpg";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://juyo.tj/items/${id}`,
        siteName: "JUYO.TJ",
        images: [{ url: imageUrl, width: 800, height: 600 }],
        type: "website",
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

export default async function ItemDetailsPage({ params }: Props) {
  const { id } = await params;
  return <ItemDetailsClient id={id} />;
}
