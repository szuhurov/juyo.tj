/**
 * Ин саҳифаи тафсилоти ашё аз Safety Box ҳаст.
 */

import { Metadata } from "next";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";
import SafetyItemDetailsClient from "./safety-item-details-client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("juyo-locale")?.value || "tg";
  const t = (translations as any)[locale] || translations.tg;

  return {
    title: `${t.mySafeItem || 'Ашёи архившуда'} | JUYO.TJ`,
    robots: { index: false, follow: false }, // Ин саҳифаҳо набояд дар Google бошанд
  };
}

function SafetyDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
        <Skeleton className="aspect-square w-full rounded-none md:rounded-[32px]" />
        <div className="flex flex-col px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-24 w-full rounded-2xl mb-8" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default async function SafetyItemPage({ params }: Props) {
  const { id } = await params;

  return (
    <Suspense fallback={<SafetyDetailSkeleton />}>
      <SafetyItemDetailsClient id={id} />
    </Suspense>
  );
}
