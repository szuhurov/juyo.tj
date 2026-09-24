/**
 * Public profile page (QR Scan View - Server Side)
 *
 * This page is built using Server Components so that
 * the data displays instantly (without a blank loading state).
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { translations } from "@/lib/translations";
import { VerifiedBadge } from "@/components/verified-badge";
import { SOCIALS, socialHref, socialPrefix } from "@/components/social-icons";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { QrSaveContactButton } from "@/components/qr-save-contact-button";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// get_qr_contact — a restricted RPC (not the profiles table directly), so that
// only one specific profile (by id) is exposed. It used to be fetched twice
// (once in generateMetadata via the heavy ItemService.getItemDetails —
// item+images+profile, and again on the page itself via this same RPC)
// with no cache — every page visit took 400-800ms. Now it's a
// single lightweight, cached (10 seconds) RPC — both generateMetadata and
// the page use this same call. increment_qr_scan_count is deliberately
// OUTSIDE this cache (below), because every real page open must count as a scan.
//
// `supabaseAdmin` (not the public anon key) is deliberate: after
// migration 20260824020000 these RPCs were REVOKEd from anon/authenticated —
// so no one can use the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
// directly (bypassing this page) request thousands of users' phone
// numbers one after another. The visible behavior for the user stays exactly the same.
const getCachedQrContact = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabaseAdmin.rpc("get_qr_contact", { p_id: id });
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

  // Priority: 1. URL parameter (?lang=) 2. Cookie 3. Default (tg)
  const locale = lang || cookieStore.get("juyo-locale")?.value || "tg";
  const t = (key: string) => {
    const value = translations[locale]?.[key];
    return typeof value === "string" ? value : key;
  };

  const { profile, error } = await getCachedQrContact(id);

  if (error || !profile) {
    notFound();
  }

  // Every open of an active page is a scan (someone scanned the printed QR
  // and landed here). In a Server Component, await is required — after
  // rendering finishes, there's no guarantee that "background" work will run.
  if (profile.is_qr_active) {
    await supabaseAdmin.rpc("increment_qr_scan_count", { p_id: id });
  }

  // If the QR is INACTIVE
  if (!profile.is_qr_active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white dark:bg-zinc-950">
        <div className="max-w-md min-[1084px]:max-w-lg space-y-8">
          <h1 className="text-xl min-[1084px]:text-2xl min-[1920px]:text-[1.75rem] font-bold tracking-[0.1em] text-emerald-600 dark:text-emerald-400 leading-tight">
            {t("qrProfileInactive").replace(
              "%{name}",
              `${profile.first_name} ${profile.last_name}`,
            )}
          </h1>
          <Button
            asChild
            className="rounded-md tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-base h-14 min-[1084px]:h-[60px] min-[1920px]:h-16 px-10 min-[1084px]:px-11 min-[1920px]:px-12 bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
          >
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Masks the last 5 digits with dots — the actual link (tel:/wa.me/t.me)
  // stays complete, only the text ON SCREEN becomes unreadable to scrapers.
  const maskTail = (raw: string) => (raw.length > 5 ? raw.slice(0, -5) + "....." : raw);

  // `profile.phone`/`secondary_phone` don't have the country code (992)
  // in the database — only that is added; the rest of the NUMBER (including
  // its leading "00" if any) stays exactly as it was stored.
  const toE164 = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits.startsWith("992") ? `+${digits}` : `+992${digits}`;
  };

  // Only networks the owner has filled in AND whose link is valid.
  // `socialHref` returns `null` for invalid text — better to show no
  // icon than link to a page that doesn't exist.
  // `display` — the actual value (@handle or +number), so next to each
  // network's icon it's visible what it actually is, not just the network's name.
  // For numbers (WhatsApp always, Telegram if it's a number) it gets masked.
  const socialLinks = SOCIALS.map((s) => {
    const raw = (profile[s.key] ?? "").trim();
    const isPhoneLike = s.key === "whatsapp" || (s.key === "telegram" && /^\d+$/.test(raw));
    const shown = isPhoneLike ? maskTail(raw) : raw;
    return {
      ...s,
      href: socialHref(s.key, raw),
      display: socialPrefix(s.key, raw) + shown,
    };
  }).filter((s): s is typeof s & { href: string } => s.href !== null);

  const phoneIntl = profile.phone ? toE164(profile.phone) : "";
  const secondaryPhoneIntl = profile.secondary_phone ? toE164(profile.secondary_phone) : "";
  const phoneShown = phoneIntl ? maskTail(phoneIntl) : "";
  const secondaryPhoneShown = secondaryPhoneIntl ? maskTail(secondaryPhoneIntl) : "";

  // If the QR is ACTIVE - FULL PAGE (one screen, no scrolling)
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col p-5 sm:p-8">
      {/* Language selector */}
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        <div className="flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full p-1 border border-hairline dark:border-zinc-800">
          {[
            { id: "tg", label: "Тоҷикӣ" },
            { id: "ru", label: "Русский" },
            { id: "en", label: "English" },
          ].map((lang) => (
            <Link
              key={lang.id}
              href={`/qr/${id}?lang=${lang.id}`}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs min-[1084px]:text-sm font-medium tracking-wide transition-all duration-300",
                locale === lang.id
                  ? "bg-emerald-500 text-white scale-105"
                  : "bg-transparent text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              {lang.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Avatar (large, centered) + name below it */}
      <div className="flex flex-col items-center text-center shrink-0">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-lg relative">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              fill
              sizes="96px"
              className="object-cover"
              alt="Avatar"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-zinc-300">
              {profile.first_name?.charAt(0)}
            </div>
          )}
        </div>
        <h1 className="mt-3 text-lg min-[1084px]:text-xl font-bold tracking-tight dark:text-white flex items-center gap-1.5">
          {profile.first_name} {profile.last_name}
          {profile.is_verified && <VerifiedBadge className="w-5 h-5 shrink-0" />}
        </h1>
        <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">
          {t("foundUserShort").replace("%{name}", profile.first_name)}
        </p>
      </div>

      {/* List: social networks (brand icon + name/number) and call
          buttons — all as rows of a single list, with slightly rounded corners
          (less than the reference example). */}
      <div className="min-h-0 overflow-y-auto flex flex-col gap-2 mt-5 sm:mt-6">
        {profile.phone ? (
          <a
            href={`tel:${phoneIntl}`}
            className="flex items-center gap-3 min-h-14 px-3.5 py-2 rounded-md bg-white dark:bg-transparent text-zinc-900 dark:text-zinc-100 transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center justify-center w-[34px] h-[34px] rounded-full bg-[#25D366] shrink-0">
              <Phone className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium truncate">{t("contactOwner")}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{phoneShown}</p>
            </div>
          </a>
        ) : (
          <div className="flex items-center justify-center min-h-14 px-3.5 py-2 rounded-md bg-amber-50 text-amber-600 font-normal text-sm">
            {t("noPhoneWarning")}
          </div>
        )}

        {profile.secondary_phone && (
          <a
            href={`tel:${secondaryPhoneIntl}`}
            className="flex items-center gap-3 min-h-14 px-3.5 py-2 rounded-md bg-white dark:bg-transparent text-zinc-900 dark:text-zinc-100 transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center justify-center w-[34px] h-[34px] rounded-full bg-[#25D366] shrink-0">
              <Phone className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium truncate">{t("contactSecondary")}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{secondaryPhoneShown}</p>
            </div>
          </a>
        )}

        {socialLinks.map(({ key, Icon, label, href, display }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-3 min-h-14 px-3.5 py-2 rounded-md bg-white dark:bg-transparent transition-transform active:scale-[0.98]"
          >
            <Icon size={34} />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{label}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{display}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Two equal flex-1 spacers — the button sits centered in the
          remaining empty space, so the gap from the list and to the bottom of the screen is equal. */}
      <div className="flex-1" />
      <div className="shrink-0">
        <QrSaveContactButton
          name={`${profile.first_name} ${profile.last_name}`}
          avatarUrl={profile.avatar_url}
          phone={phoneIntl || null}
          secondaryPhone={secondaryPhoneIntl || null}
          socials={{
            telegram: profile.telegram,
            instagram: profile.instagram,
            whatsapp: profile.whatsapp,
            facebook: profile.facebook,
          }}
          labels={{
            save: t("saveContactToGallery"),
            saved: t("contactSavedSuccess"),
            error: t("error"),
            contactOwner: t("contactOwner"),
            contactSecondary: t("contactSecondary"),
          }}
        />
      </div>
      <div className="flex-1" />
    </div>
  );
}
