/**
 * Саҳифаи ҷамъиятии профил (QR Scan View - Server Side)
 *
 * Ин саҳифа бо истифода аз Server Components сохта шудааст, то ки
 * маълумот лаҳзавӣ (бе лоудинги сиёҳ) нишон дода шавад.
 */

import { ItemService } from "@/lib/services/item-service";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { useLanguage } from "@/lib/language-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, ShieldCheck, QrCode, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { cookies } from "next/headers";
import { translations } from "@/lib/translations";
import { VerifiedBadge } from "@/components/verified-badge";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await searchParams;

  try {
    const cookieStore = await cookies();
    const locale = lang || cookieStore.get("juyo-locale")?.value || "tg";
    const t = (key: string) => translations[locale as any]?.[key] || key;

    // Гирифтани маълумоти соҳиби QR
    const item = await ItemService.getItemDetails(id);
    const profile = item?.profiles;
    return {
      title: `${profile?.first_name} ${profile?.last_name} | JUYO.TJ`,
      description: t("foundUserItem").replace(
        "%{name}",
        `${profile?.first_name} ${profile?.last_name}`,
      ),
    };
  } catch (e) {
    return { title: "JUYO.TJ" };
  }
}

export default async function PublicQRPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { lang } = await searchParams;
  const cookieStore = await cookies();

  // Афзалият: 1. Параметри URL (?lang=) 2. Cookie 3. Дефолт (tg)
  const locale = lang || cookieStore.get("juyo-locale")?.value || "tg";
  const t = (key: string) => translations[locale as any]?.[key] || key;

  // Боргузории маълумот дар сервер (SSR) — тавассути RPC-и махдуд (на ҷадвали profiles мустақим),
  // то ки танҳо як профили мушаххас (бо id) намоён шавад, на ҳамаи корбарон.
  const { supabase } = await import("@/lib/supabase");
  const { data: profileRows, error } = await supabase.rpc("get_qr_contact", { p_id: id });
  const profile = profileRows?.[0];

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
        <div className="max-w-md space-y-8">
          <h1 className="text-xl font-black tracking-[0.1em] text-zinc-900 dark:text-white leading-tight">
            {t("qrProfileInactive").replace(
              "%{name}",
              `${profile.first_name} ${profile.last_name}`,
            )}
          </h1>
          <Button
            asChild
            className="rounded-2xl font-black tracking-widest text-[10px] h-14 px-10 bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 transition-all active:scale-95"
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
                "px-4 py-2 rounded-full text-[11px] font-black tracking-wider transition-all duration-300",
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
            <div className="w-32 h-32 border-4 border-white dark:border-zinc-800 shadow-2xl rounded-[2.5rem] overflow-hidden bg-zinc-100 relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-300">
                  {profile.first_name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-2xl shadow-lg border-4 border-white dark:border-zinc-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tighter mb-2 dark:text-white flex items-center justify-center gap-2">
            {profile.first_name} {profile.last_name}
            {profile.is_verified && <VerifiedBadge className="w-6 h-6" />}
          </h1>

          <div className="max-w-md mx-auto bg-zinc-50 dark:bg-zinc-800/50 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 mb-10 mt-6 relative">
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold text-lg italic">
              {t("foundUserItem").replace("%{name}", profile.first_name)}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            {profile.phone ? (
              <Button
                size="lg"
                className="w-full max-w-xs h-16 px-10 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 font-black tracking-widest gap-3 shadow-xl transition-all active:scale-95"
                asChild
              >
                <a href={`tel:${profile.phone}`}>
                  <Phone className="w-5 h-5" />
                  {t("contactOwner")}
                </a>
              </Button>
            ) : (
              <div className="bg-amber-50 text-amber-600 px-6 py-4 rounded-2xl border border-amber-100 font-bold text-[10px] tracking-widest">
                {t("noPhoneWarning")}
              </div>
            )}

            {profile.secondary_phone && (
              <Button
                size="lg"
                variant="outline"
                className="w-full max-w-xs h-14 px-10 rounded-2xl border-2 border-zinc-900 dark:border-zinc-100 font-black tracking-widest gap-3 transition-all active:scale-95 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                asChild
              >
                <a href={`tel:${profile.secondary_phone}`}>
                  <Phone className="w-4 h-4" />
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

function Badge({ children, className, variant = "default" }: any) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold inline-block",
        variant === "default"
          ? "bg-zinc-900 text-white"
          : "border border-zinc-200 text-zinc-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
