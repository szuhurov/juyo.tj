"use client";

import { useParams } from "next/navigation";
import { ItemDetailsSkeleton } from "@/components/item-details-skeleton";
import ItemDetailsClient from "./item-details-client";

/**
 * While the server renders the page, the client component already shows what
 * the list caches hold (title, text, photo) and skeletons only for the rest.
 */
export default function ItemDetailsLoading() {
  const { id } = useParams<{ id?: string }>();
  if (!id) return <ItemDetailsSkeleton />;
  return <ItemDetailsClient id={id} />;
}
