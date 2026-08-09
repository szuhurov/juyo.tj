/**
 * Саҳифаи ҷамъиятии профил (QR Scan View - Server Side)
 *
 * Ин саҳифа бо истифода аз Server Components сохта шудааст, то ки
 * маълумот лаҳзавӣ (бе лоудинги сиёҳ) нишон дода шавад.
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { translations } from "@/lib/translations";
import { VerifiedBadge } from "@/components/verified-badge";
import { supabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// get_qr_contact — RPC-и махдуд (на ҷадвали profiles мустақим), то ки танҳо
// як профили мушаххас (бо id) намоён шавад. Пештар ин ду бор фетч мешуд
// (як бор дар generateMetadata тавассути ItemService.getItemDetails-и
// вазнин — item+images+profile, боз як бор дар худи саҳифа тавассути
// ҳамин RPC) ва бе кэш — ҳар гузариш ба саҳифа 400-800ms мегирифт. Ҳоло
// як RPC-и сабук, кэшшуда (10 сония) — ҳам generateMetadata, ҳам саҳифа
// аз ҳамин истифода мебаранд. increment_qr_scan_count АЗ ин кэш берун
// аст (поён), чунки ҳар кушоиши воқеӣ бояд ҳамчун scan ҳисоб шавад.
const getCachedQrContact = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabase.rpc("get_qr_contact", { p_id: id });
    return { profile: data?.[0] ?? null, error };
  },
  ["qr-contact"],
  { revalidate: 10 },
);

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await searchParams;

  try {
    const cookieStore = await cookies();
    const locale = lang || cookieStore.get("juyo-locale")?.value || "tg";
    const t = (key: string) => {
      const value = translations[locale]?.[key];
      return typeof value === "string" ? value : key;
    };

    const { profile } = await getCachedQrContact(id);
    return {
      title: `${profile?.first_name} ${profile?.last_name} | JUYO.TJ`,
      description: t("foundUserItem").replace(
        "%{name}",
        `${profile?.first_name} ${profile?.last_name}`,
      ),
    };
  } catch {
    return { title: "JUYO.TJ" };
  }
}

export default async function PublicQRPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { lang } = await searchParams;
  const cookieStore = await cookies();

  // Афзалият: 1. Параметри URL (?lang=) 2. Cookie 3. Дефолт (tg)
  const locale = lang || cookieStore.get("juyo-locale")?.value || "tg";
  const t = (key: string) => {
    const value = translations[locale]?.[key];
    return typeof value === "string" ? value : key;
  };

  const { profile, error } = await getCachedQrContact(id);

  if (error || !profile) {
    notFound();
  }

  // Ҳар кушоиши саҳифаи фаъол як scan аст (касе QR-и чопшударо scan карда,
  // ин ҷо расидааст). Дар Server Component await лозим аст — баъд аз ба охир
  // расидани render, кори "background" кафолат надорад, ки иҷро шавад.
  if (profile.is_qr_active) {
    await supabase.rpc("increment_qr_scan_count", { p_id: id });
  }

  // Агар QR ҒАЙРИФАЪОЛ БОШАД
  if (!profile.is_qr_active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white dark:bg-zinc-950">
        <div className="max-w-md min-[1084px]:max-w-lg space-y-8">
          <h1 className="text-xl min-[1084px]:text-2xl min-[1920px]:text-[1.75rem] font-black tracking-[0.1em] text-emerald-600 dark:text-emerald-400 leading-tight">
            {t("qrProfileInactive").replace(
              "%{name}",
              `${profile.first_name} ${profile.last_name}`,
            )}
          </h1>
          <Button
            asChild
            className="rounded-2xl font-black tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-base h-14 min-[1084px]:h-[60px] min-[1920px]:h-16 px-10 min-[1084px]:px-11 min-[1920px]:px-12 bg-emerald-500 text-white shadow-xl hover:bg-emerald-600 transition-all"
          >
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Агар QR ФАЪОЛ БОШАД - САҲИФАИ ПУРРА
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Селектори забон - Дизайни аслӣ */}
      <div className="fixed top-6 left-0 right-0 z-50 flex items-center justify-center px-4 sm:px-8">
        <div className="flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full p-1.5 shadow-xl border border-zinc-200 dark:border-zinc-800">
          {[
            { id: "tg", label: "Тоҷикӣ" },
            { id: "ru", label: "Русский" },
            { id: "en", label: "English" },
          ].map((lang) => (
            <Link
              key={lang.id}
              href={`/qr/${id}?lang=${lang.id}`}
              className={cn(
                "px-4 min-[1084px]:px-5 min-[1920px]:px-6 py-2 min-[1084px]:py-2.5 rounded-full text-sm min-[1084px]:text-base min-[1920px]:text-lg font-black tracking-wider transition-all duration-300",
                locale === lang.id
                  ? "bg-emerald-500 text-white shadow-lg scale-105"
                  : "bg-transparent text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              {lang.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 pt-32 pb-12">
        <div className="container mx-auto px-4 text-center">
          <div className="relative inline-block mb-6">
            <div className="w-32 h-32 min-[1084px]:w-36 min-[1084px]:h-36 min-[1920px]:w-40 min-[1920px]:h-40 border-4 border-white dark:border-zinc-800 shadow-2xl rounded-[2.5rem] overflow-hidden bg-zinc-100 relative">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  fill
                  sizes="(min-width: 1920px) 160px, (min-width: 1084px) 144px, 128px"
                  className="object-cover"
                  alt="Avatar"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-300">
                  {profile.first_name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-700 text-white p-2 rounded-2xl shadow-lg border-4 border-white dark:border-zinc-900">
              <ShieldCheck className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7" />
            </div>
          </div>

          <h1 className="text-3xl min-[1084px]:text-4xl min-[1920px]:text-[2.5rem] font-black tracking-tighter mb-2 dark:text-white flex items-center justify-center gap-2">
            {profile.first_name} {profile.last_name}
            {profile.is_verified && <VerifiedBadge className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 min-[1920px]:w-8 min-[1920px]:h-8" />}
          </h1>

          <div className="max-w-md min-[1084px]:max-w-lg mx-auto bg-zinc-50 dark:bg-zinc-800/50 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 mb-10 mt-6 relative">
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold text-lg min-[1084px]:text-xl min-[1920px]:text-[1.375rem] italic">
              {t("foundUserItem").replace("%{name}", profile.first_name)}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            {profile.phone ? (
              <Button
                size="lg"
                className="w-full max-w-xs min-[1084px]:max-w-sm h-16 min-[1084px]:h-[70px] min-[1920px]:h-[76px] px-10 min-[1084px]:px-11 min-[1920px]:px-12 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-black tracking-widest text-base min-[1084px]:text-lg min-[1920px]:text-xl gap-3 shadow-xl transition-all"
                asChild
              >
                <a href={`tel:${profile.phone}`}>
                  <Phone className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7" />
                  {t("contactOwner")}
                </a>
              </Button>
            ) : (
              <div className="bg-amber-50 text-amber-600 px-6 py-4 rounded-2xl border border-amber-100 font-bold text-xs min-[1084px]:text-sm min-[1920px]:text-base tracking-widest">
                {t("noPhoneWarning")}
              </div>
            )}

            {profile.secondary_phone && (
              <Button
                size="lg"
                variant="outline"
                className="w-full max-w-xs min-[1084px]:max-w-sm h-14 min-[1084px]:h-[60px] min-[1920px]:h-16 px-10 min-[1084px]:px-11 min-[1920px]:px-12 rounded-2xl border-2 border-zinc-900 dark:border-zinc-100 font-black tracking-widest text-sm min-[1084px]:text-base min-[1920px]:text-lg gap-3 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                asChild
              >
                <a href={`tel:${profile.secondary_phone}`}>
                  <Phone className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5" />
                  {t("contactSecondary")}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
