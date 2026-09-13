/**
 * Ин саҳифаи Профили корбар ҳаст.
 * Дар ин ҷо корбар метавонад эълонҳои худро идора кунад, маълумоти шахсиашро иваз кунад,
 * ва QR-коди худро созад.
 */ "use client";

import { useEffect, useState, useRef, Suspense } from "react"; // Барои идоракунии вақт, ҳолат ва боргирии саҳифа
import dynamic from "next/dynamic";
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs"; // Барои кор бо маълумоти корбари воридшуда ва баромад аз сайт
import { useLanguage } from "@/lib/language-context"; // Барои идоракунии забони интерфейс
import {
  ITEM_GRID_CLASS,
  JUST_PUBLISHED_EVENT,
  JUST_PUBLISHED_KEY,
  PUBLISH_COUNTDOWN_MS,
  type JustPublishedState,
} from "@/lib/ui-constants";
import { useTheme } from "next-themes";
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { Profile, ProfileService } from "@/lib/services/profile-service"; // Барои идоракунии маълумоти шахсии корбар
import { ItemCard } from "@/components/item-card"; // Барои нишон додани карточкаҳои эълонҳо
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Барои нишон додани сурати корбар
import { Skeleton } from "@/components/ui/skeleton"; // Барои ҳолати боргирии муваққатӣ
import { Input } from "@/components/ui/input"; // Майдони воридкунии матн
import { PhoneInput } from "@/components/phone-input"; // Майдони телефон бо рамзи давлат
import { Label } from "@/components/ui/label"; // Сарлавҳаҳо барои майдонҳои форма
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба базаи Supabase
import { getErrorMessage } from "@/lib/error-utils"; // Паёми хониданӣ аз хатогии Clerk/Supabase
import {
  User,
  Settings,
  Bookmark,
  LogOut,
  ChevronRight,
  PackageSearch,
  Mail,
  LayoutGrid,
  Trash2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  QrCode,
  Menu as MenuIcon,
  Download,
  Palette,
  KeyRound,
  MousePointerClick,
  Globe,
  UserCog,
  Grid2x2,
  Scan,
  Droplet,
  Sparkles,
  X,
  Pointer,
  Check,
  Smartphone,
  Home,
  type LucideIcon,
} from "lucide-react";
// Иконкаҳои гуногун барои интерфейс
import Link from "next/link"; // Барои пайвандҳо ба саҳифаҳои дигар
import { useRouter, useSearchParams } from "next/navigation"; // Барои идоракунии адрес ва параметрҳои URL
import { cn } from "@/lib/utils"; // Барои пайваст кардани классҳои CSS
import { readableTextOn, isNearWhite } from "@/lib/qr-palette";
import { DotStyleChip, CornerBorderChip, CornerCenterChip, StyleChipRow, type ChipDotType } from "@/components/qr-editor/qr-style-chips";
import { PercentSlider, GradientBiasToggle } from "@/components/qr-editor/percent-slider";
import {
  SOCIALS,
  socialPrefix,
  sanitizeSocialInput,
  type SocialKey,
} from "@/components/social-icons"; // Нишонаҳои брендии Telegram/Instagram/WhatsApp
import { toast } from "sonner"; // Барои нишон додани огоҳиномаҳо
import {
  TooltipProvider,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳои кӯтоҳ
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои тасдиқкунанда (модалкаҳо)
import { ConfirmDialog } from "@/components/ui/confirm-dialog"; // Тирезаи умумии тасдиқи амал
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Интеграцияи QR
// Ин компонент html-to-image ва react-colorful-ро истифода мебарад (вазнин)
// ва танҳо дар tab-и QR лозим аст — на дар tab-ҳои "Эълонҳо"/"Захирашуда",
// ки дефолт мебошанд.
const QRCard = dynamic(
  () => import("@/components/qr-editor/qr-card").then((m) => m.QRCard),
  {
    // Бе ин, ҳангоми боркунии аввалини chunk-и QRCard, React suspend
    // мешавад ва азбаски ҷои худаш Suspense надорад, ба Suspense-и
    // берунии ProfilePage (spinner-и калони сиёҳ, поён дар ин файл)
    // мебарояд — тамоми саҳифа паси skeleton-и дуруст боз як бор бо
    // spinner иваз мешуд.
    loading: () => (
      <Skeleton className="aspect-square w-[210px] h-[210px] rounded-2xl" />
    ),
  },
);
import type { DotType, CornerSquareType, CornerDotType } from "qr-code-styling"; // Навъҳои дурусти услуби QR (ба ҷои `any`)
import { toPng } from "html-to-image"; // Барои табдил додани HTML ба сурати PNG
import { HexColorPicker } from "react-colorful"; // Барои интихоби ранги QR-код

import { Checkbox } from "@/components/ui/checkbox";
import {
  useUserItems,
  useSavedItems,
} from "@/lib/hooks/use-items"; // Хукҳои махсус барои гирифтани ашёҳо аз база
import { useQueryClient } from "@tanstack/react-query"; // Барои идоракунии кэши маълумотҳо
import { VerifiedBadge } from "@/components/verified-badge";
import { useProfileQuery } from "@/lib/hooks/use-profile";

// Клерк одатан хатогиро ҳамчун { errors: [{ code, longMessage, message }] }
// мефиристад — вале `message`/`longMessage` ҲАМЕША бо забони англисӣ меоянд,
// новобаста аз забони интихобии сайт. Талаби корбар: "дар ҳама ҳолат ... бо
// забони интихобшуда нишон дода шавад" — пас ба ҷои матни хоми Clerk, КОДИ
// хаторо (устувор, аз забон вобаста нест) ба калиди тарҷумаи худамон
// мегардонем (ҳамон `clerk.errors.*`-е, ки `lib/clerk-localization.ts`
// барои виҷетҳои тайёри Clerk истифода мебарад — ин ҷо низ ҳамонҳоро).
const CLERK_ERROR_CODE_TO_KEY: Record<string, string> = {
  form_password_length_too_short: "clerk.errors.passwordTooShort",
  form_identifier_not_found: "clerk.errors.userNotFound",
  form_password_incorrect: "clerk.errors.wrongPassword",
  form_identifier_exists: "clerk.errors.emailExists",
  form_code_incorrect: "clerk.errors.incorrectCode",
  rate_limit_exceeded: "clerk.errors.tooManyRequests",
  form_password_pwned: "clerk.passwordPwned",
};

function getClerkErrorMessage(
  err: unknown,
  fallback: string,
  t: (key: string) => string,
): string {
  if (err && typeof err === "object" && "errors" in err) {
    const code = (err as { errors?: { code?: string }[] }).errors?.[0]?.code;
    if (code && CLERK_ERROR_CODE_TO_KEY[code]) return t(CLERK_ERROR_CODE_TO_KEY[code]);
  }
  // Ҳеҷ гоҳ матни хоми Clerk намонад — хатои умумии тарҷумашуда бехатартар аст.
  return fallback;
}

/** Барчаспи майдонҳои танзимоти QR — панҷ майдон пештар се услуби гуногун
 *  доштанд (яке бе иконка, дигаре бо андоза ва ранги дигар). Як компонент
 *  кафолат медиҳад, ки ҳамаашон якхела монанд. */
function QrFieldLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 ml-1">
      <Icon className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <Label className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
        {children}
      </Label>
    </div>
  );
}

/** Сатҳи ягонаи ҳамаи идоракунандаҳои QR (Select ва тугмаҳои ранг), то
 *  баландӣ, кунҷ ва рафтори hover дар ҳарду режим якхела бошанд. Пештар
 *  `hover:bg-zinc-50` варианти `dark:` надошт — дар режими торик ҳангоми
 *  hover майдон сафед мешуд. */
/**
 * Ду сатҳи QR.
 *
 *   basic — QR-и стандартӣ, ҳеҷ танзимот, бепул
 *   pro   — ранг/шакл/матни худӣ + градиент
 *
 * Дар `pro` худи КӮШИШИ тағйир озод аст — қулф танҳо ҳангоми БОРГИРӢ
 * меафтад. Ин қасдан аст: корбар бояд натиҷаро бинад, баъд қарор кунад,
 * ки харад.
 */
type QrTier = "basic" | "pro";

/** Тартиб, нишона ва матни ҳар сатҳ — як манбаъ барои ҳар ду тугма. */
const QR_TIERS = [
  { id: "basic" as const, icon: QrCode, labelKey: "qrTierBasic" },
  { id: "pro" as const, icon: Sparkles, labelKey: "qrTierPro" },
];

/**
 * Қарори маҳсулот (муваққатӣ, мувофиқи native): азбаски «Худӣ» ҳоло
 * ройгон аст, гузариш ба «Оддӣ» маъно надорад — тугмаи интихоби сатҳ
 * ПИНҲОН. Мантиқи «Оддӣ» (isBasicTier, QR_BASIC) НЕСТ карда НАШУДААСТ —
 * танҳо роҳи UI ба он баста шуд.
 */
const SHOW_TIER_SELECTOR = false;

/**
 * Фоизи АЗ НУҚТАИ НАЗАРИ stop-и додашуда — айнан formula-и native (ниг.
 * `biasPercentForStop` дар `juyoapp/app/(tabs)/profile.tsx`). Барои
 * stopIdx=0 фоизи БАРЪАКС нишон дода мешавад (100-percent), барои
 * stopIdx=1 — айнан. Ин ҳам ба рақами НИШОНДОДАШУДА, ҳам ба bias-и
 * ВОҚЕИИ рендер таъсир мерасонад — бе ин ду репо рақами гуногун
 * медиҳанд, гарчанде дар база як арзиш захира шудааст.
 */
const biasPercentForStop = (percent: number, stopIdx: number) => (stopIdx === 0 ? 100 - percent : percent);

/** Ранги ягонаи намунаҳои chip — на ранги ҷории QR, то муқоисаи шакл равшан монад. */
const QR_CHIP_INK = "#000000";

/**
 * Вариантҳои шакл барои chip-picker — 5 то, айнан native
 * (square/rounded/extra-rounded/diamond/classy-rounded).
 *
 * "diamond" ХОСИСИИ ХАТАРНОК аст: `qr-code-styling` (китобхонаи ВЕБ, на
 * native) чунин навъро ТАМОМАН НАДОРАД (DotType-и он танҳо
 * dots|rounded|classy|classy-rounded|square|extra-rounded аст). Талаби
 * корбар: чиппа нишон диҳад, ҳарчанд QR-и воқеӣ фарқ накунад — пас
 * "diamond" танҳо дар РӮЙХАТИ ИНТИХОБ аст; ҳангоми фиристодан ба QRCard
 * он ба "square" мегузарад (ниг. `effDotsType` — АЙНАН ҳамон пешфарзи
 * дохилии худи китобхона барои навъи номаълум).
 */
const DOT_TYPES: ChipDotType[] = ["square", "rounded", "extra-rounded", "diamond", "classy-rounded"];
/**
 * "rounded" АЗ РӮЙХАТ БАРДОШТА ШУД: талаби корбар, баъд аз он ки
 * ошкор шуд `qr-code-styling` (китобхонаи ВЕБ, на native) чунин навъро
 * воқеан НАДОРАД — dispatcher-и китобхона (`QRCornerSquare.draw`) танҳо
 * "square" ва "extra-rounded"-ро алоҳида кор мефармояд, ҳар чизи дигар
 * (аз ҷумла "rounded") ба "dot" мегузарад. Пас интихоби "rounded" дар QR-и
 * воқеӣ АЙНАН ҳамон "dot"-ро медод — фарқе набуд. Ниг. санҷиши манбаи
 * `node_modules/qr-code-styling/lib/qr-code-styling.common.js`.
 */
const CORNER_TYPES: (CornerSquareType & CornerDotType)[] = ["square", "extra-rounded", "dot"];
/** Ҳадди боло-и бари ҳар чиппа — айнан native (`chipMaxWidth={30}`). */
const CHIP_MAX_WIDTH = 30;
const DOT_LABEL_KEYS: Record<ChipDotType, string> = {
  square: "qrDotSquare",
  dots: "qrDotDots",
  rounded: "qrDotRounded",
  "extra-rounded": "qrDotExtraRounded",
  classy: "qrDotClassy",
  "classy-rounded": "qrDotClassyRounded",
  diamond: "qrDotDiamond",
};
/** Ҳамон CORNER_LABEL_KEYS-и native: «extra-rounded» = «Мулоим» дар ҳарду. */
const CORNER_LABEL_KEYS: Partial<Record<CornerSquareType | CornerDotType, string>> = {
  square: "qrCornerSquare",
  rounded: "qrCornerRounded",
  "extra-rounded": "qrCornerRounded",
  dot: "qrCornerDot",
};

/** Ҳолати «Оддӣ» — нуқтаи ҳисоб барои он ки чӣ «тағйирёфта» аст. */
const QR_BASIC = {
  color: "#26ba90",
  bg: "#eefbf5",
  /**
   * Нуқтаҳои сатҳи БЕПУЛ чоркунҷаанд.
   *
   * Ин ҳудуди байни бепул ва пулакиро равшан мекунад: шаклҳои мулоим ва
   * классикӣ маҳз чизеанд, ки корбар барояшон мехарад. Мураббаъ шакли
   * аслии QR аст ва ҳамеша беҳтарин сканшавандагӣ дорад.
   */
  dots: "square" as DotType,
  /**
   * Кунҷҳои сатҳи БЕПУЛ мураббаъанд — ҳамон мантиқи нуқтаҳо.
   */
  corners: "square" as CornerSquareType & CornerDotType,
};

function ProfileContent() {
  // Хукҳо барои гирифтани маълумоти корбар ва забони сайт
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  // Мавзӯъ. `themeMounted` — то hydration мавзӯи воқеӣ (хусусан "system")
  // дар сервер номаълум аст; бе ин байрақ тугмаи нодуруст фаъол менамояд
  // ва React огоҳии hydration mismatch медиҳад.
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Стейтҳо барои идоракунии табҳо (вкладки) ва танзимоти QR
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "posts",
  );
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  /** Кадом stop-и кадом градиент ҳозир дар picker кушода аст. */
  const [activePicker, setActivePicker] = useState<{ kind: "text" | "bg"; index: number } | null>(
    null,
  );
  const [showWhyQRModal, setShowWhyQRModal] = useState(false);
  /** Обои-и экрани қулф хусусияти телефонӣ аст — дар веб тугма ҳаст (мисли native), вале модали шарҳдиҳанда мекушояд. */
  const [showWallpaperInfoModal, setShowWallpaperInfoModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  // ADMIN_USER_IDS дар сервер аст (env-и берун аз NEXT_PUBLIC_) — ин
  // саҳифа "use client" аст, пас статуси admin-ро тавассути API-и хурд
  // мегирем (танҳо ба худи корбар мегӯяд, ки ӯ admin аст ё не).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/admin/whoami")
      .then((res) => res.json())
      .then((data) => setIsAdmin(!!data.isAdmin))
      .catch(() => {});
  }, []);

  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [emailStep, setEmailStep] = useState<"input" | "verify">("input");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailCodeInput, setEmailCodeInput] = useState("");
  const [pendingEmailAddress, setPendingEmailAddress] = useState<NonNullable<typeof user>["emailAddresses"][number] | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSubmitting, setResendSubmitting] = useState(false);

  const resetEmailModal = () => {
    setShowEmailChangeModal(false);
    setEmailStep("input");
    setNewEmailInput("");
    setEmailCodeInput("");
    setPendingEmailAddress(null);
    setResendCooldown(0);
  };

  // Ҳисоб аз 59 сония то иҷозати аз нав фиристодани рамз.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendCode = async () => {
    if (!pendingEmailAddress || resendCooldown > 0 || resendSubmitting) return;
    setResendSubmitting(true);
    try {
      await pendingEmailAddress.prepareVerification({ strategy: "email_code" });
      setResendCooldown(59);
      toast.success(t("codeResent"));
    } catch (err) {
      console.error("Resend code error:", err);
      toast.error(getClerkErrorMessage(err, t("error"), t));
    } finally {
      setResendSubmitting(false);
    }
  };

  const handleStartEmailChange = async () => {
    if (!user || !newEmailInput) return;
    setEmailSubmitting(true);
    try {
      // Сохтани почтаи нав аз сервер (Backend API) — то бо ҳисобҳои бе
      // parol (масалан бо Google) ё ҳангоми дубора илова кардани почтае,
      // ки қаблан аз ин ҳисоб нест шуда буд, ба "Cannot verify your
      // account" дучор нашавем.
      const res = await fetch("/api/account/start-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start email change");

      await user.reload();
      const emailAddress = user.emailAddresses.find((e) => e.id === data.emailAddressId);
      if (!emailAddress) throw new Error("Email address not found after creation");

      await emailAddress.prepareVerification({ strategy: "email_code" });
      setPendingEmailAddress(emailAddress);
      setEmailStep("verify");
      setResendCooldown(59);
    } catch (err) {
      console.error("Start email change error:", err);
      toast.error(getClerkErrorMessage(err, t("error"), t));
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!user || !pendingEmailAddress) return;
    setEmailSubmitting(true);
    try {
      await pendingEmailAddress.attemptVerification({ code: emailCodeInput });

      // Боқии кор — асосӣ кардани почтаи нав, канда партофтани пайвасти
      // беруна (агар почтаи куҳна ба Google пайваст бошад), нест кардани
      // почтаи куҳна ва синхронизатсия бо Supabase — аз сервер (Backend
      // API, бо secret key) иҷро мешавад. Ин reverification талаб
      // намекунад, пас ҳисобҳои бе parol (масалан бо Google) низ бе
      // "Cannot verify your account" кор мекунанд.
      const res = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmailId: pendingEmailAddress.id }),
      });
      if (!res.ok) throw new Error("Failed to change email");

      await user.reload();
      toast.success(t("emailChangeSuccess"));
      resetEmailModal();
    } catch (err) {
      console.error("Clerk error:", err);
      toast.error(getClerkErrorMessage(err, t("error"), t));
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      // Route-и сервер ҳам Clerk (Backend API, secret key) ва ҳам Supabase-ро
      // мустақим нест мекунад — reverification (парол/телефон) лозим намекунад,
      // пас ҳисобҳои бе parol (масалан бо Google) низ бе мушкил нест мешаванд.
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error("Failed to delete account");

      toast.success(t("deleteAccountSuccess"));
      router.push("/");
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error(t("error"));
      setDeletingAccount(false);
    }
  };

  // Стейтҳо барои нигоҳ доштани маълумоти профил ва нишон додани модалҳо
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter истифода мешавад, вале UI-и он (MandatoryPhoneModal) ба дарахти компонент васл нашудааст, ниг. ёддошти аудит
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showSecondaryPhoneModal, setShowSecondaryPhoneModal] = useState(false);
  /**
   * Кадом амал модали пуркуниро кушод.
   *
   * Модал акнун аз ду ҷо кушода мешавад — боргирӣ ва фаъол кардани
   * статус — ва пас аз захира бояд маҳз ҳамон амал идома ёбад. Бе ин
   * ҳарду роҳ ба боргирӣ мебурданд.
   */
  const [pendingQrAction, setPendingQrAction] =
    useState<"download" | "activate" | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Шабакаҳои иҷтимоӣ — ИХТИЁРӢ, пас на ба шарти боргирӣ дохил мешаванд
  // ва на тугмаро ғайрифаъол мекунанд. Пӯшида меоянд, то формаро дароз
  // накунанд; корбар худаш мекушояд, агар хоҳад.
  const [showSocial, setShowSocial] = useState(false);
  const [social, setSocial] = useState<Record<SocialKey, string>>({
    telegram: "",
    instagram: "",
    whatsapp: "",
    facebook: "",
  });
  /**
   * Ҳамон шабакаҳо, вале барои ФОРМАИ «Танзимот» — алоҳида аз `social`
   * (он барои модали боргирӣ аст ва қасдан ҳамеша холӣ оғоз мешавад).
   * Ин ҷо баръакс: бояд қиматҳои ҳозираи профилро нишон диҳад, то
   * префикси @/+ (ниг. `socialPrefix`) ҳамон тавре ки дар модал кор
   * кунад — талаби корбар.
   */
  const [infoSocial, setInfoSocial] = useState<Record<SocialKey, string>>({
    telegram: "",
    instagram: "",
    whatsapp: "",
    facebook: "",
  });
  useEffect(() => {
    if (!profile) return;
    setInfoSocial({
      telegram: profile.telegram || "",
      instagram: profile.instagram || "",
      whatsapp: profile.whatsapp || "",
      facebook: profile.facebook || "",
    });
  }, [profile]);
  const [showTermsDetails, setShowTermsDetails] = useState(false);

  // Стейт барои танзимоти намуди зоҳирии QR-код (рангҳо ва шакл).
  // Пешфарз "pro" — мувофиқи native (SHOW_TIER_SELECTOR боло).
  const [qrTier, setQrTier] = useState<QrTier>("pro");
  /**
   * Градиенти МАТН/нуқтаҳо — то 2 ранг. Пешфарз ҳамон ҷуфти native
   * (кабуд → сабзи брендии JUYO, 74% ба сабз).
   */
  const [qrGradientStops, setQrGradientStops] = useState<string[]>(["#2563EB", "#26BA90"]);
  const [qrGradientBiasPercent, setQrGradientBiasPercent] = useState(74);
  /** Кадом stop ҳозир "интихобшуда" (барои `biasPercentForStop`) — пешфарз 0, мисли native. */
  const [gradientStopIdx, setGradientStopIdx] = useState(0);
  /**
   * Кунҷи градиенти МАТН — талаби корбар: тугмаи "давр" (rotate) бояд
   * кунҷро давр занонад (45°→135°→225°→315°, 4 ҳолат), НА рангҳоро
   * ҷойиваз кунад. Пештар `onRotate` рангҳоро reverse мекард — акнун
   * рангҳо СОБИТ мемонанд, танҳо кунҷ мечархад.
   */
  const [qrGradientAngle, setQrGradientAngle] = useState(45);
  /** Градиенти ЗАМИНА (BG) — ҳамон сохтор, алоҳида. */
  const [qrBgGradientStops, setQrBgGradientStops] = useState<string[]>(["#FFFFFF", "#EEFBF5"]);
  const [qrBgGradientBiasPercent, setQrBgGradientBiasPercent] = useState(50);
  const [bgGradientStopIdx, setBgGradientStopIdx] = useState(0);
  const [qrBgGradientAngle, setQrBgGradientAngle] = useState(45);
  const [qrSettings, setQrSettings] = useState({
    dotsType: "rounded" as ChipDotType,
    cornersSquareType: "dot" as CornerSquareType,
    cornersDotType: "dot" as CornerDotType,
  });
  // Профил — тавассути React Query (кэши 2 дақиқа), на бо fetch-и дастии
  // бе кэш — пеш аз ин ҳар гузариш ба /profile (масалан home → QR →
  // бозгашт) skeleton-и наверо нишон медод, ҳатто агар чанд сония пеш
  // аллакай fetch шуда буд.
  const { data: queriedProfile, isError: profileQueryError } = useProfileQuery(userId, getToken);
  useEffect(() => {
    if (queriedProfile !== undefined) {
      setProfile(queriedProfile);
      setProfileLoading(false);

      // Агар рақами телефон набошад, тирезаи махсусро нишон медиҳем (ТАНҲО рақами асосӣ)
      if (queriedProfile && (!queriedProfile.phone || queriedProfile.phone.trim() === "")) {
        setShowPhoneModal(true);
      }
    } else if (profileQueryError) {
      setProfileLoading(false);
    }
  }, [queriedProfile, profileQueryError]);

  // Гирифтани рӯйхати эълонҳо, ашёҳои захирашуда ва ашёҳои "Қуттии бехатарӣ"
  const { data: myItems = [], isLoading: postsLoading } = useUserItems(
    userId || undefined,
    getToken,
  );
  const { data: savedItems = [], isLoading: savedLoading } = useSavedItems(
    userId || undefined,
    getToken,
  );
  // Эълоне, ки корбар ҳозир нашр кард — дар болои акси он ҳисобкунаки
  // санҷиш нишон дода мешавад.
  //
  // "Тамом" фавран ба ин ҷо мегузарад, вале сабти эълон метавонад ҳанӯз
  // дар паси парда идома дошта бошад. Пас id аз ду роҳ меояд: event (агар
  // сабт баъд аз кушода шудани ин саҳифа тамом шавад) ё sessionStorage
  // (агар пеш аз он тамом шуда бошад).
  const [justPublished, setJustPublished] =
    useState<JustPublishedState | null>(null);

  useEffect(() => {
    // Ҳолати кӯҳна (масалан аз нашри дирӯза, ки корбар онро надид) набояд
    // ҳисобкунакро дубора нишон диҳад.
    const isFresh = (s: JustPublishedState) =>
      Date.now() - s.startedAt < PUBLISH_COUNTDOWN_MS;

    const take = (state: JustPublishedState | null) => {
      if (!state || !isFresh(state)) return;
      setJustPublished(state);
      // Танҳо баъд аз он ки id расид, тоза мекунем — вагарна қайди
      // "нашр дар ҷараён" пеш аз расидани эълон гум мешавад.
      if (state.id) {
        try {
          sessionStorage.removeItem(JUST_PUBLISHED_KEY);
        } catch {
          // Safari-и private mode — зарар нест.
        }
      }
    };

    try {
      const raw = sessionStorage.getItem(JUST_PUBLISHED_KEY);
      if (raw) take(JSON.parse(raw) as JustPublishedState);
    } catch {
      // хониш ё JSON-и вайрон — сарфи назар мекунем.
    }

    const onPublished = (e: Event) =>
      take((e as CustomEvent<JustPublishedState>).detail);
    window.addEventListener(JUST_PUBLISHED_EVENT, onPublished);
    return () => window.removeEventListener(JUST_PUBLISHED_EVENT, onPublished);
  }, []);

  const justPublishedId = justPublished?.id ?? null;
  const [infoSubmitting, setInfoSubmitting] = useState(false);
  // Табҳои "Танзимот" ба сабки рӯйхати iOS сохта шудаанд — маълумоти шахсӣ
  // ва рӯйхати корбарони басташуда ба ҷои ҳамеша кушода будан, бо клик
  // ба сатри худашон боз/пӯшида мешаванд.
  const [openSetting, setOpenSetting] = useState<"profile" | null>(null);

  // Синхронизатсия кардани таби фаъол бо URL.
  //
  // ХАТОГИИ ЁФТШУДА (талаби корбар: "тугмаҳои навбар кор намекунанд"):
  // пештар ин ҷо ФАҚАТ вақте `activeTab` иваз мешуд, ки `tab` дар URL
  // МАВҶУД бошад. Тугмаи "Профиль" (href="/profile", БЕ tab) аз таби
  // QR клик карда, URL-ро иваз мекард, вале `activeTab` "qr" мемонд —
  // корбар ҳамон мӯҳтавои QR-ро мебинад, гӯё тугма кор намекунад.
  useEffect(() => {
    const tab = searchParams.get("tab");
    const validTab =
      tab && ["posts", "info", "saved", "qr"].includes(tab) ? tab : "posts";
    setActiveTab(validTab);
  }, [searchParams]);

  /**
   * Функсия барои иваз кардани таб (вкладка) ва нав кардани URL
   */
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`/profile?${params.toString()}`, { scroll: false });
  };

  // Элементҳои менюи паҳлӯӣ (Sidebar Menu)
  const LANGUAGES: Array<{ code: "tg" | "ru" | "en"; label: string }> = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  const THEMES: Array<{ value: string; labelKey: string }> = [
    { value: "system", labelKey: "themeSystem" },
    { value: "light", labelKey: "themeLight" },
    { value: "dark", labelKey: "themeDark" },
  ];

  // Ҳамаи icon-ҳои меню як ранг (emerald) доранд — рангҳои гуногун
  // (кабуд/бунафш/индиго) маънои алоҳида надоштанд ва танҳо оройиш буданд.
  const menuItems = [
    {
      id: "posts",
      title: t("myPosts"),
      icon: LayoutGrid,
      color: "text-zinc-500",
      bg: "",
    },
    {
      id: "info",
      title: t("settings"),
      icon: Settings,
      color: "text-zinc-500",
      bg: "",
    },
    {
      id: "qr",
      title: t("qrMyCode"),
      icon: QrCode,
      color: "text-zinc-500",
      bg: "",
    },
    {
      id: "saved",
      title: t("savedItems"),
      icon: Bookmark,
      color: "text-zinc-500",
      bg: "",
    },
  ];

  useEffect(() => {
    const handleItemsUpdate = () =>
      queryClient.invalidateQueries({ queryKey: ["items", "list"] });
    const handleSavedUpdate = () =>
      queryClient.invalidateQueries({ queryKey: ["items", "saved"] });
    window.addEventListener("items-updated", handleItemsUpdate);
    window.addEventListener("saved-items-updated", handleSavedUpdate);
    return () => {
      window.removeEventListener("items-updated", handleItemsUpdate);
      window.removeEventListener("saved-items-updated", handleSavedUpdate);
    };
  }, [queryClient]);

  // Click outside to close color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        activePicker &&
        !target.closest(".color-picker-container") &&
        !target.closest(".color-trigger")
      ) {
        setActivePicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activePicker]);

  /**
   * Логикаи асосии боргирии QR-код (барои он ки аз ду ҷой истифода барем)
   */
  const executeQRDownload = async () => {
    if (!qrRef.current) return;

    setIsDownloading(true);
    try {
      // Интизори хурд барои боварӣ аз он ки ҳама элементҳо дуруст рендер шудаанд
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        pixelRatio: 4, // Баланд бардоштани сифат барои чоп
        skipFonts: false,
        backgroundColor: undefined, // Ин имкон медиҳад, ки кунҷҳои rounded шаффоф монанд
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          borderRadius: "0.8rem", // Боварӣ ҳосил мекунем, ки кунҷҳо мудаввар мемонанд (medium)
        },
      });

      // Агар дар дохили React Native WebView бошад
      if (typeof window !== "undefined" && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "DOWNLOAD_QR", payload: dataUrl }),
        );
        toast.success(t("qrSavedSuccess"));
        return;
      }

      // Стандарт боргирӣ (Desktop ва Mobile Web Browser)
      const link = document.createElement("a");
      link.download = `juyo-qr-sticker.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t("qrSavedSuccess"));
    } catch (err) {
      console.error("Download error:", err);
      toast.error(t("error"));
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Танзимоти ВОҚЕАН кашидашаванда.
   *
   * Дар «Оддӣ» ҳамеша ҳолати стандартӣ кашида мешавад, ҳатто агар корбар
   * пештар дар «Худсоз» чизе иваз карда бошад — вагарна гузариш ба «Оддӣ»
   * QR-и худсозро нишон медод ва маънои сатҳҳо гум мешуд. Интихоби корбар
   * гум намешавад: он дар `qrSettings` мемонад ва ҳангоми бозгашт ба
   * «Худсоз» барқарор мешавад.
   */
  /**
   * Маълумоти ҳатмӣ пур нашудааст.
   *
   * Ҳам боргирӣ ва ҳам фаъол кардани статус аз ҳамин як шарт мегузаранд —
   * вагарна ду ҷои код метавонистанд аз ҳам дур шаванд.
   */
  const isQrDataMissing =
    !profile?.phone ||
    !profile?.secondary_phone ||
    profile?.accepted_terms !== true;

  /** Калид танҳо вақте фаъол менамояд, ки QR воқеан кор карда тавонад. */
  const qrToggleOn = !!profile?.is_qr_active && !isQrDataMissing;

  /**
   * Иваз кардани статуси фаъол/хомӯши QR — аз таби QR ба «Танзимот»
   * кӯчонида шуд (мисли native), пас ба функсияи алоҳида баровардем, то
   * дар ҷои нав такрор нашавад.
   */
  const handleToggleQrActive = async () => {
    if (!profile) return;
    const previousState = profile.is_qr_active;
    const newState = !previousState;

    /**
     * ФАЪОЛ кардан маълумоти пурра талаб мекунад.
     *
     * QR-и фаъол бе рақами телефон маънӣ надорад: ёбанда саҳифаро
     * мекушояд ва он ҷо ҳеҷ роҳи тамос намебинад. Бинобар ин ба ҷои
     * гузоштани калид модали пуркуниро мекушоем ва баъд аз захира
     * худамон фаъол мекунем. ХОМӮШ кардан ҳамеша озод аст.
     */
    if (newState && isQrDataMissing) {
      setPendingQrAction("activate");
      setShowSecondaryPhoneModal(true);
      return;
    }

    // Optimistic update
    setProfile({ ...profile, is_qr_active: newState });

    try {
      const supabase = createClerkSupabaseClient(getToken);

      // Background update
      ProfileService.updateProfile(supabase, userId!, { is_qr_active: newState })
        .then((updated) => {
          setProfile(updated);
          toast.success(newState ? t("qrActivatedSuccess") : t("qrDeactivatedSuccess"));
        })
        .catch((err) => {
          console.error(err);
          setProfile({ ...profile, is_qr_active: previousState });
          toast.error(t("error"));
        });
    } catch (err) {
      console.error(err);
      setProfile({ ...profile, is_qr_active: previousState });
      toast.error(t("error"));
    }
  };

  const isBasicTier = qrTier === "basic";
  const activeGradient = !isBasicTier && qrGradientStops.length >= 2 ? qrGradientStops : null;
  const effQrColor = isBasicTier ? QR_BASIC.color : qrGradientStops[0];
  const effBgColor = isBasicTier ? QR_BASIC.bg : qrBgGradientStops[0];
  const effBgGradientColor = !isBasicTier && qrBgGradientStops.length >= 2 ? qrBgGradientStops[1] : null;
  // "diamond" танҳо дар chip аст (ниг. DOT_TYPES боло) — QRCard навъи
  // воқеии китобхонаро (DotType) мехоҳад, пас ин ҷо ба "square" мегузарад,
  // АЙНАН ҳамон пешфарзи дохилии `qr-code-styling` барои навъи номаълум.
  const effDotsType: DotType = isBasicTier
    ? QR_BASIC.dots
    : qrSettings.dotsType === "diamond"
      ? "square"
      : qrSettings.dotsType;
  const effCornersSquareType = isBasicTier ? QR_BASIC.corners : qrSettings.cornersSquareType;
  const effCornersDotType = isBasicTier ? QR_BASIC.corners : qrSettings.cornersDotType;
  /** Тақсимот (%) → bias: 50% = 1 (баробар), 90% = 1.8, 10% = 0.2. */
  const effGradientBias = activeGradient
    ? biasPercentForStop(qrGradientBiasPercent, gradientStopIdx) / 50
    : 1;
  const effBgGradientBias = effBgGradientColor
    ? biasPercentForStop(qrBgGradientBiasPercent, bgGradientStopIdx) / 50
    : 1;

  /** Оё корбар аз ҳолати стандартӣ дур рафтааст? */
  const isQrCustomized =
    effQrColor.toLowerCase() !== QR_BASIC.color.toLowerCase() ||
    effBgColor.toLowerCase() !== QR_BASIC.bg.toLowerCase() ||
    effDotsType !== QR_BASIC.dots ||
    effCornersSquareType !== QR_BASIC.corners ||
    effCornersDotType !== QR_BASIC.corners ||
    !!activeGradient ||
    !!effBgGradientColor;

  /**
   * Қарори маҳсулот (муваққатӣ): «Худӣ» ҳоло РОЙГОН аст — то backend-и
   * воқеии пардохт (SmartPay) пайваст шавад, тугмаи «Харидан» ҳоло
   * танҳо toast бо «Ба қарибӣ дастрас мешавад» мебарорад, пас қулфи
   * харид бе хариди воқеӣ маънои надорад. Вақте SmartPay пайваст шавад,
   * ин байрақро `true` кунед.
   */
  const PAYWALL_ENABLED = false;
  const isQrLocked = PAYWALL_ENABLED && !isBasicTier && isQrCustomized;

  /**
   * Блоки градиент — барои МАТН ва барои ЗАМИНА такрор мешавад, ҳамон
   * тавре ки native ин ду блокро (бо танзимоти ҷудогона) такрор мекунад.
   * Функсия аст, на компонент, то holo давра дар ҳар render аз нав
   * СОХТА нашавад (танҳо JSX мебарорад).
   */
  const renderGradientBlock = (kind: "text" | "bg") => {
    const stops = kind === "text" ? qrGradientStops : qrBgGradientStops;
    const setStops = kind === "text" ? setQrGradientStops : setQrBgGradientStops;
    const rawBiasPercent = kind === "text" ? qrGradientBiasPercent : qrBgGradientBiasPercent;
    const setRawBiasPercent = kind === "text" ? setQrGradientBiasPercent : setQrBgGradientBiasPercent;
    const stopIdx = kind === "text" ? gradientStopIdx : bgGradientStopIdx;
    const setStopIdx = kind === "text" ? setGradientStopIdx : setBgGradientStopIdx;
    const angle = kind === "text" ? qrGradientAngle : qrBgGradientAngle;
    const setAngle = kind === "text" ? setQrGradientAngle : setQrBgGradientAngle;
    const labelKey = kind === "text" ? "qrGradientLabel" : "qrBgLabel";
    const secondColorDefault = kind === "text" ? "#26BA90" : "#EEFBF5";
    const showStops = stops.length >= 2;
    const isPickerOpenHere = activePicker?.kind === kind;
    /** Фоизи НИШОНДОДАШУДА — аз нуқтаи назари stop-и ҳозир интихобшуда. */
    const displayPercent = biasPercentForStop(rawBiasPercent, stopIdx);
    const setDisplayPercent = (v: number) => setRawBiasPercent(biasPercentForStop(v, stopIdx));

    return (
      <div key={kind} className="flex-1 min-w-0">
        <QrFieldLabel icon={kind === "text" ? Sparkles : Droplet}>{t(labelKey)}</QrFieldLabel>

        <div className="relative mt-2">
          {showStops ? (
            <div
              className={cn(
                "h-12 rounded-xl mb-2.5",
                stops.some(isNearWhite) && "border border-zinc-200 dark:border-zinc-700",
              )}
              style={{ backgroundImage: `linear-gradient(${angle}deg, ${stops[0]}, ${stops[1]})` }}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStopIdx(0);
                setActivePicker({ kind, index: 0 });
              }}
              aria-label={stops[0]}
              className="w-full h-12 rounded-xl flex items-center gap-2.5 px-3.5 mb-2.5 color-trigger transition-transform active:scale-[0.98]"
              style={{ backgroundColor: stops[0] }}
            >
              <Pointer className="size-[18px] shrink-0" style={{ color: readableTextOn(stops[0]) }} strokeWidth={2.25} />
              <span className="text-[13px] font-bold tracking-wide uppercase truncate" style={{ color: readableTextOn(stops[0]) }}>
                {stops[0].toUpperCase()}
              </span>
            </button>
          )}

          <div className="flex items-center gap-2 h-[30px]">
            {showStops &&
              stops.map((col, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStopIdx(i);
                    setActivePicker({ kind, index: i });
                  }}
                  aria-label={col}
                  className={cn(
                    "relative size-[22px] shrink-0 rounded-full transition-transform color-trigger shadow-sm",
                    isPickerOpenHere && activePicker?.index === i && "scale-110",
                    isNearWhite(col) && "border border-zinc-200 dark:border-zinc-700",
                  )}
                  style={{ backgroundColor: col }}
                >
                  {isPickerOpenHere && activePicker?.index === i && (
                    <span className="absolute -top-[3px] -right-[3px] flex items-center justify-center size-3 rounded-full bg-emerald-500 ring-[1.5px] ring-white dark:ring-zinc-800">
                      <Check className="size-[7px] text-white" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              ))}

            {!showStops ? (
              <button
                type="button"
                onClick={() => {
                  setStops((prev) => [...prev, secondColorDefault]);
                  setStopIdx(1);
                  setActivePicker({ kind, index: 1 });
                }}
                aria-label={t("qrGradientAddColor")}
                className="flex items-center justify-center size-[22px] shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <span className="text-[13px] font-bold leading-none -mt-px">+</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStops((prev) => prev.slice(0, 1))}
                aria-label={t("qrGradientRemoveColor")}
                className="flex items-center justify-center size-[22px] shrink-0 rounded-full bg-zinc-50 dark:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="size-3" />
              </button>
            )}

            {showStops && (
              <GradientBiasToggle
                percent={displayPercent}
                onRotate={() => setAngle((a) => (a + 90) % 360)}
              />
            )}
          </div>

          {/* Талаби корбар: слайдер ҳамеша кушода мемонад. */}
          {showStops && (
            <PercentSlider value={displayPercent} onChange={setDisplayPercent} />
          )}

          {isPickerOpenHere && (
            <div className="fixed inset-x-0 bottom-[56px] sm:bottom-auto sm:absolute sm:inset-0 sm:top-auto z-40 sm:z-[60] p-0 bg-white dark:bg-zinc-950 sm:rounded-2xl shadow-2xl border-t sm:border border-zinc-100 dark:border-zinc-800 color-picker-container overflow-hidden">
              <div className="flex justify-center p-4">
                <HexColorPicker
                  color={stops[activePicker!.index] ?? stops[0]}
                  onChange={(color) =>
                    setStops((prev) => {
                      const next = [...prev];
                      next[activePicker!.index] = color;
                      return next;
                    })
                  }
                  className="!w-full !h-40"
                />
              </div>
              <div className="p-4 pt-0 pb-8 sm:pb-4">
                <Button
                  className="w-full h-11 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
                  onClick={() => setActivePicker(null)}
                >
                  {t("done")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Функсия барои боргирии QR-код ҳамчун сурат (Download)
   */
  const handleDownloadQR = async () => {
    if (isQrDataMissing) {
      setPendingQrAction("download");
      setShowSecondaryPhoneModal(true);
      return;
    }

    await executeQRDownload();
  };

  /**
   * Функсия барои захира кардани маълумоти амниятӣ ва давом додани боргирӣ
   */
  const handleSaveSecondaryPhone = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    const needsPhone = !profile?.phone;
    const needsSecondary = !profile?.secondary_phone;
    const needsTerms = profile?.accepted_terms !== true;

    if (needsTerms && !acceptedTerms) {
      toast.error(t("terms.error") || "Лутфан шартҳоро қабул кунед");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const phone = ((formData.get("phone") as string) || "").trim();
    const secondary_phone = (
      (formData.get("secondary_phone") as string) || ""
    ).trim();

    if (needsPhone && needsSecondary && phone === secondary_phone) {
      toast.error(t("phonesMustBeDifferent"));
      return;
    }

    setSecondaryLoading(true);
    try {
      const supabase = createClerkSupabaseClient(getToken);

      const updates: Partial<Profile> = {};
      if (needsPhone) updates.phone = phone;
      if (needsSecondary) updates.secondary_phone = secondary_phone;
      // Шабакаҳо ихтиёрианд: танҳо онҳое, ки корбар воқеан пур кардааст,
      // фиристода мешаванд — вагарна сатрҳои холӣ қиматҳои кӯҳнаро мепӯшонанд.
      for (const key of SOCIALS.map((sn) => sn.key)) {
        const v = social[key].trim();
        if (v) updates[key] = v;
      }
      if (needsTerms) {
        updates.accepted_terms = true;
        updates.accepted_at = new Date().toISOString();
        updates.terms_version = "v1.0";
      }

      const updated = await ProfileService.updateProfile(
        supabase,
        userId!,
        updates,
      );

      setProfile(updated);
      setShowSecondaryPhoneModal(false);
      toast.success(t("success"));

      // Пас аз захира ҳамон амале идома меёбад, ки модалро кушода буд.
      const next = pendingQrAction;
      setPendingQrAction(null);
      if (next === "activate") {
        const activated = await ProfileService.updateProfile(supabase, userId!, {
          is_qr_active: true,
        });
        setProfile(activated);
        toast.success(t("qrActivatedSuccess"));
      } else {
        await executeQRDownload();
      }
    } catch (err) {
      // `err` (масалан PostgrestError-и Supabase) дар console.error
      // ҳамчун `{}` намоён мешавад, чунки хосиятҳояш дар JSON-и объекти
      // хом дуруст сериализатсия намешаванд — `getErrorMessage` онҳоро
      // мустақим мехонад (`.message`), пас паёми воқеӣ дида мешавад.
      console.error("Error saving profile setup:", getErrorMessage(err), err);
      toast.error(t("error"));
    } finally {
      setSecondaryLoading(false);
    }
  };

  /**
   * Функсияи паҳн кардани QR-код (Share)
   */
  if (!userLoaded) return null;

  // Нишон додани мӯҳтаво вобаста ба таби интихобшуда
  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6">
            {/* Рӯйхати эълонҳои шахсӣ */}
            <div>
              {postsLoading ? (
                <div className={ITEM_GRID_CLASS}>
                  {[...Array(3)].map((_, i) => (
                    <ItemCardSkeleton key={i} variant="profile" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {myItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      justPublishedAt={
                        item.id === justPublishedId
                          ? justPublished?.startedAt
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <PackageSearch className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 text-xs min-[1084px]:text-sm tracking-widest">
                    {t("noItemsFound")}
                  </h4>
                </div>
              )}
            </div>
          </div>
        );

      case "posts2":
        return (
          <div className="space-y-6">
            {/* Рӯйхати эълонҳои шахсӣ */}
            <div className="">
              {postsLoading ? (
                <div className={ITEM_GRID_CLASS}>
                  {[...Array(3)].map((_, i) => (
                    <ItemCardSkeleton key={i} variant="profile" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <PackageSearch className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 text-xs min-[1084px]:text-sm tracking-widest">
                    {t("noItemsFound")}
                  </h4>
                </div>
              )}
            </div>
          </div>
        );

      case "qr":
        // profile ҳанӯз client-side fetch мешавад (Clerk token → Supabase) —
        // то он вақт skeleton нишон медиҳем, на UI-и нопурраи бо
        // profile=null (тугмаҳои вайрон, QR-и холӣ), то гузариш аз дигар
        // саҳифа ба ин таб "холӣ меистад" ҳис нашавад.
        if (profileLoading) {
          return (
            <div className="space-y-8 pb-32">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start px-2">
                <Skeleton className="aspect-square w-full max-w-sm mx-auto rounded-[2rem]" />
                <div className="space-y-5">
                  <Skeleton className="h-10 w-40 rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          );
        }
        return (
          // `pb-4`, на `pb-32`: талаби корбар — саҳифа набояд аз таги
          // QR-код scroll шавад. `pb-32` барои ҷуброни навбари поёнии
          // мобил буд, вале акнун панели танзимот худаш дар дохили худ
          // `max-h-[50dvh]` scroll мешавад (ниг. шарҳи он поён), пас ин
          // фазои иловагӣ дигар лозим нест.
          <div className="space-y-8 pb-4">
            {/* Интихоби сатҳ — болои ҳама чиз, то корбар пеш аз ҳама
                бифаҳмад, ки кадом реҷа фаъол аст.
                Пинҳон (SHOW_TIER_SELECTOR): ниг. шарҳи он дар боло. */}
            {SHOW_TIER_SELECTOR && (
            <div className="px-2">
              <div role="tablist" className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {QR_TIERS.map(({ id, icon: TierIcon, labelKey }) => {
                  const active = qrTier === id;
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setQrTier(id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-colors",
                        active
                          ? "bg-emerald-500 text-white"
                          // Матн ва нишона СИЁҲ, на хокистарӣ — сабки тугмаҳои Telegram.
                          : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700",
                      )}
                    >
                      <TierIcon className="w-5 h-5" />
                      <span className="text-[11px] font-bold">{t(labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Танзимоти намуди зоҳирии QR */}
            <div className="space-y-8">
              {/* `gap-5` дар мобил (на `gap-8`): талаби корбар — панели
                  танзимот бояд ба тугмаҳо наздиктар бошад ва саҳифа
                  scroll нашавад. `gap-3` санҷида шуд — хеле танг буд
                  (талаби корбар: "аз ҳад зиёд боло бурдед"), `gap-5`
                  мобайнист. Дар md+ (сутунҳои паҳлӯӣ) гапи калон (12)
                  мемонад — он ҷо танзимот дар зери тугмаҳо нест. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-12 items-start px-2">
                {/* Пешнамоиши QR (Preview) */}
                {/* Сутуни пешнамоиш. Танҳо ХУДИ QR sticky аст — корти
                    статус, тугмаҳо ва танзимот аз таги он мегузаранд. */}
                <div className="flex flex-col">
                <div className="sticky top-[12px] sm:top-[66px] z-30 md:relative md:top-0 bg-canvas/80 backdrop-blur-md -mx-2.5 sm:-mx-4 px-1.5 pt-0 pb-1 md:p-0 md:bg-transparent md:backdrop-blur-none transition-all duration-300">
                  {/* Корти САФЕД бо хати мулоим — ҳамон намуди кортҳои
                      профил. Пештар ин ҷо хати РЕХТА буд: он ба «ҷои холии
                      интизорӣ» ишора мекунад, дар ҳоле ки корт мӯҳтавои
                      пурра дорад. */}
                  {/* `w-full`: талаби корбар — панели QR бояд ҳамон паҳноии
                      панели танзимот (поён)-ро дошта бошад, то лаби чапу
                      рости ду корт дар як сутун баробар шаванд. Пештар
                      `w-fit` буд, то корт танҳо ба андозаи QR танг шавад —
                      вале ин ду кортро номувозӣ менамуд.

                      `aspect-square`: талаби корбар — панел бояд КВАДРАТ
                      бошад, ва `w-full` (бе ҳадди max-w) — талаби корбар:
                      "квадрат full width бошад". Ҳадди max-w-[280px] (барои
                      "бе scroll") бозгашт дода шуд. */}
                  <div className="relative group bg-white dark:bg-zinc-800 rounded-3xl p-3 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 w-full aspect-square overflow-hidden shadow-none transition-all duration-300">
                    <div className="scale-95 md:scale-100 min-[1084px]:scale-110 min-[1503px]:scale-[1.15] origin-center transition-transform duration-300 shrink-0">
                      <QRCard
                        id={user?.id || ""}
                        qrCode={profile?.qr_code}
                        settings={{
                          qrColor: effQrColor,
                          bgColor: effBgColor,
                          dotsType: effDotsType,
                          cornersSquareType: effCornersSquareType,
                          cornersDotType: effCornersDotType,
                          borderRadius: "medium",
                          shadow: "soft",
                          hasBorder: false,
                          pattern: "none",
                          gradientColors: activeGradient,
                          gradientBias: effGradientBias,
                          gradientAngle: qrGradientAngle,
                          bgGradientColor: effBgGradientColor,
                          bgGradientBias: effBgGradientBias,
                          bgGradientAngle: qrBgGradientAngle,
                        }}
                        className="qr-card-mobile-hide-text"
                        innerRef={qrRef}
                      />
                    </div>
                  </div>
                </div>

                {/* Статуси QR аз ин ҷо БАРОМАД — мисли native, акнун дар
                    таби «Танзимот» (гурӯҳи «Афзалиятҳо»), зеро ба тарҳи
                    стикер дахл надорад. Ниг. `handleToggleQrActive`. */}


                {/* Боргирӣ — ё озод, ё қулф.
                    Қулф танҳо вақте меафтад, ки корбар воқеан аз ҳолати
                    стандартӣ дур рафта бошад: дар табҳои худсоз, вале бе
                    тағйирот, боргирӣ бепул мемонад. */}
                {/* `mt-4`: талаби корбар — панели танзимот бояд ба тугмаҳо
                    наздиктар шавад ва саҳифа scroll нашавад (ниг. `gap-3`-и
                    грид низ боло). */}
                {isQrLocked ? (
                  <div className="mt-5 w-full px-1">
                    <Button
                      onClick={() => toast.info(t("qrComingSoon"))}
                      className="w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-600 border-none shadow-none text-white font-bold text-[11px] min-[1084px]:text-xs tracking-normal transition-all"
                    >
                      {t("qrBuy")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-5 w-full px-1">
                    <Button
                      onClick={handleDownloadQR}
                      disabled={isDownloading}
                      className="flex-1 h-11 rounded-lg bg-emerald-500 hover:bg-emerald-600 border-none shadow-none text-white font-bold text-[11px] min-[1084px]:text-xs tracking-normal transition-all gap-1.5 px-2.5"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 min-[1084px]:w-[18px] min-[1084px]:h-[18px] text-white" />
                      )}
                      {t("download")}
                    </Button>
                    {/* Обои-и экрани қулф хусусияти телефонӣ аст — дар веб
                        имконнопазир. Тугма мисли native намоён аст (талаби
                        мутобиқат), вале пахш модали шарҳдиҳанда мекушояд, на
                        амали воқеӣ. */}
                    <Button
                      onClick={() => setShowWallpaperInfoModal(true)}
                      variant="outline"
                      className="flex-1 h-11 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-none text-zinc-900 dark:text-white font-bold text-[11px] min-[1084px]:text-xs tracking-normal transition-all gap-1.5 px-2.5"
                    >
                      <Smartphone className="w-3.5 h-3.5 min-[1084px]:w-[18px] min-[1084px]:h-[18px]" />
                      {t("qrWallpaperBtn")}
                    </Button>
                  </div>
                )}
                </div>

                {/* Ҳама танзимот танҳо дар «Худсоз» ва «Pro».
                    Дар «Оддӣ» сутун қасдан холӣ мемонад. */}
                {!isBasicTier && (
                // Панел: px-3, space-y-1.5 АЙНАН native-и `qrPanel`
                // (paddingHorizontal:12) + `gap:6`-и байни сексияҳо.
                //
                // `pt-2 pb-3` (на native-и pt-3.5/pb-7): талаби корбар —
                // саҳифа УМУМАН набояд scroll шавад, ва панел бояд ба
                // тугмаҳои боло наздиктар бошад. Ба ин хотир бошиши
                // native-ро қасдан кам кардем.
                <div className="space-y-1.5 px-3 pt-4 pb-6 rounded-3xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  {/* Градиенти матн ва градиенти замина дар ЯК қатор —
                      АВВАЛ меоянд (тартиби native: градиент → шакли нуқтаҳо
                      → кунҷҳо, на баръакс). */}
                  <div className="flex gap-4">
                    {renderGradientBlock("text")}
                    {renderGradientBlock("bg")}
                  </div>

                  {/* Шакли нуқтаҳо — chip-и визуалӣ, на dropdown-и матнӣ:
                      ҳар вариант худашро нишон медиҳад. Намунаҳо ЯКРАНГАНД
                      (QR_CHIP_INK, на ранги ҷории QR) — талаби мутобиқат
                      бо native. */}
                  <div className="space-y-2">
                    <QrFieldLabel icon={Grid2x2}>{t("qrDotsStyle")}</QrFieldLabel>
                    <StyleChipRow
                      options={DOT_TYPES}
                      value={qrSettings.dotsType}
                      onChange={(v) => setQrSettings({ ...qrSettings, dotsType: v })}
                      labelFor={(v) => t(DOT_LABEL_KEYS[v])}
                      chipMaxWidth={CHIP_MAX_WIDTH}
                      renderChip={(v) => <DotStyleChip type={v} qrColor={QR_CHIP_INK} bgColor="transparent" />}
                    />
                  </div>

                  {/* Фосилаи КАЛОН (28px, айнан native) байни ду гурӯҳ —
                      бо фосилаи хурд онҳо як қатори ягона менамуданд. */}
                  <div className="flex gap-7">
                    <div className="flex-1 space-y-2 min-w-0">
                      <QrFieldLabel icon={Scan}>{t("qrCornersStyle")}</QrFieldLabel>
                      <StyleChipRow
                        options={CORNER_TYPES}
                        value={qrSettings.cornersSquareType}
                        onChange={(v) => setQrSettings({ ...qrSettings, cornersSquareType: v })}
                        labelFor={(v) => t(CORNER_LABEL_KEYS[v]!)}
                        chipMaxWidth={CHIP_MAX_WIDTH}
                        renderChip={(v) => <CornerBorderChip type={v} qrColor={QR_CHIP_INK} bgColor="transparent" />}
                      />
                    </div>

                    {/* Маркази чашмак — интихоби СЕЮМИ мустақил.
                        Пештар он аз ҳошия бармеомад ва корбар ба он даст
                        расонда наметавонист. */}
                    <div className="flex-1 space-y-2 min-w-0">
                      <QrFieldLabel icon={Scan}>{t("qrCornerCenterStyle")}</QrFieldLabel>
                      <StyleChipRow
                        options={CORNER_TYPES}
                        value={qrSettings.cornersDotType}
                        onChange={(v) => setQrSettings({ ...qrSettings, cornersDotType: v })}
                        labelFor={(v) => t(CORNER_LABEL_KEYS[v]!)}
                        chipMaxWidth={CHIP_MAX_WIDTH}
                        renderChip={(v) => <CornerCenterChip type={v} qrColor={QR_CHIP_INK} bgColor="transparent" />}
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="pb-20">
            {/* Сарлавҳаи таби Танзимот */}
            {/* Full-bleed: `-mx-*` шофияи волидро мекашад ва `px-*` онро
                дубора медиҳад — бинобар ин ҳарду бояд БАЙНИ breakpoint-ҳо
                бо шофияи волид (`px-2 sm:px-4`) баробар монанд, вагарна
                банд аз экран мебарояд ва scroll-и уфуқӣ пайдо мешавад. */}
            <div className="sticky top-0 z-40 bg-canvas/80 backdrop-blur-md pt-4 pb-4 px-2.5 -mx-2.5 sm:px-4 sm:-mx-4 mb-4">
              <h3 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight">
                {t("settings")}
              </h3>
            </div>

            <div className="max-w-2xl px-2 space-y-6">
              {/* Корти профил — аватар, ном, почта */}
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="w-14 h-14 rounded-full overflow-hidden">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback className="bg-zinc-900 text-white text-xl font-bold">
                      {user?.firstName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center cursor-pointer">
                    <Pencil className="w-3 h-3 text-white" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            toast.loading(t("uploading"));
                            await user?.setProfileImage({ file });
                            toast.dismiss();
                            toast.success(t("photoUpdated"));
                          } catch {
                            toast.dismiss();
                            toast.error(t("error"));
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base text-zinc-900 dark:text-zinc-100 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>

              {/* Гурӯҳи "Ҳисоб" */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold tracking-wider text-zinc-400 px-4">
                  {t("account")}
                </p>
                <div className="bg-white dark:bg-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {/* Маълумоти шахсӣ — сатри кушодашаванда */}
                  <button
                    type="button"
                    onClick={() => setOpenSetting(openSetting === "profile" ? null : "profile")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <User className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("personalInfo")}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-zinc-400 shrink-0 transition-transform",
                        openSetting === "profile" && "rotate-90",
                      )}
                    />
                  </button>

                  {openSetting === "profile" && (
                  <div className="px-4 py-4">
                  {/* Формаи таҳрири маълумоти профил */}
                  <form
                    key={profile?.id || "new"}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const firstName = formData.get("firstName") as string;
                      const lastName = formData.get("lastName") as string;
                      const phone = (
                        (formData.get("phone") as string) || ""
                      ).trim();
                      const secondaryPhone = (
                        (formData.get("secondaryPhone") as string) || ""
                      ).trim();

                      if (phone === secondaryPhone) {
                        toast.error(t("phonesMustBeDifferent"));
                        return;
                      }

                      /**
                       * Шабакаҳо ҲАМЕША ҳар чор фиристода мешаванд, ҳатто
                       * холӣ.
                       *
                       * Route сатри холиро ба `null` табдил медиҳад, яъне
                       * пайвандро нест мекунад. Модали боргирӣ баръакс кор
                       * мекунад — он танҳо майдонҳои пуршударо мефиристад
                       * ва аз он ҷо нест кардан ғайриимкон аст.
                       */
                      const socialValues = Object.fromEntries(
                        SOCIALS.map(({ key }) => [
                          key,
                          sanitizeSocialInput(key, ((formData.get(key) as string) || "").trim()),
                        ]),
                      );

                      setInfoSubmitting(true);
                      try {
                        // Ном/насаб ва рақамҳоро аз сервер (Backend API)
                        // иваз мекунем — то бо ҳисобҳои бе parol (масалан
                        // бо Google) ба хатогии "first_name is not a
                        // valid parameter" ё reverification дучор нашавем.
                        const res = await fetch("/api/account/update-profile", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ firstName, lastName, phone, secondaryPhone, ...socialValues }),
                        });
                        if (!res.ok) throw new Error("Failed to update profile");
                        const { profile: updated } = await res.json();
                        setProfile(updated);
                        await user?.reload();

                        toast.success(t("profileUpdated"));
                      } catch (err) {
                        console.error("Profile Update Error:", err);
                        toast.error(t("error"));
                      } finally {
                        setInfoSubmitting(false);
                      }
                    }}
                    className="flex-1 space-y-4 w-full"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                          {t("firstName")}
                        </Label>
                        <Input
                          name="firstName"
                          defaultValue={user?.firstName || ""}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                          {t("lastName")}
                        </Label>
                        <Input
                          name="lastName"
                          defaultValue={user?.lastName || ""}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                          {t("phoneLabel")}
                        </Label>
                        <PhoneInput
                          name="phone"
                          placeholder={t("phonePlaceholder")}
                          defaultValue={profile?.phone || ""}
                          containerClassName="h-10 bg-white dark:bg-zinc-950"
                          className="text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                          {t("phoneSecondaryLabel")}
                        </Label>
                        <PhoneInput
                          name="secondaryPhone"
                          placeholder={t("phoneSecondaryPlaceholder")}
                          defaultValue={profile?.secondary_phone || ""}
                          containerClassName="h-10 bg-white dark:bg-zinc-950"
                          className="text-xs"
                          required
                        />
                      </div>
                    </div>

                    {/* Шабакаҳои иҷтимоӣ. Майдони холӣ = пайванд нест
                        мешавад. */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.socialBtn")}
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SOCIALS.map(({ key, Icon, label }) => {
                          const prefix = socialPrefix(key, infoSocial[key]);
                          return (
                            <div key={key} className="relative">
                              <Icon
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                              {/* Аломат ба қимат дохил намешавад — танҳо
                                  намоишӣ, мисли дар модали боргирӣ. */}
                              <span
                                aria-hidden
                                className="absolute left-9 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 pointer-events-none"
                              >
                                {prefix}
                              </span>
                              <Input
                                name={key}
                                placeholder={label}
                                value={infoSocial[key]}
                                className="h-10 pl-[3.25rem] rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                onChange={(e) => {
                                  const v = sanitizeSocialInput(key, e.target.value);
                                  setInfoSocial((s) => ({ ...s, [key]: v }));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[9px] font-bold text-zinc-400 px-1 leading-snug">
                        {t("qrSecondaryModal.socialHint")}
                      </p>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={infoSubmitting}
                      className="rounded-lg bg-emerald-500 text-white font-bold text-[9px] tracking-widest px-6 w-full sm:w-auto"
                    >
                      {infoSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        t("save")
                      )}
                    </Button>
                  </form>
                  </div>
                  )}

                  {/* Почтаи электронӣ */}
                  <button
                    type="button"
                    onClick={() => setShowEmailChangeModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <Mail className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("email")}
                    </span>
                    <span className="max-w-[45%] truncate text-xs font-medium text-zinc-400">
                      {user?.primaryEmailAddress?.emailAddress}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>

                  {/* Рамз */}
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <KeyRound className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("changePassword")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Гурӯҳи "Афзалиятҳо" */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold tracking-wider text-zinc-400 px-4">
                  {t("preferences")}
                </p>
                <div className="bg-white dark:bg-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {/* Забон — арзиши ҷорӣ дар тарафи рост, мисли намунаи iOS */}
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Globe className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                      <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t("language") || "Забон"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setLocale(lang.code)}
                          className={cn(
                            "flex-1 h-9 rounded-xl font-bold text-[11px] tracking-wide transition-all cursor-pointer",
                            locale === lang.code
                              ? "bg-emerald-500 text-white"
                              : "bg-canvas dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400",
                          )}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Мавзӯъ — ҳамон намуди segmented мисли забон.
                      `mounted` лозим аст, чунки то hydration мавзӯи воқеӣ
                      маълум нест ва бе он тугмаи нодуруст фаъол менамояд. */}
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Palette className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                      <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t("theme")}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {THEMES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTheme(opt.value)}
                          className={cn(
                            "flex-1 h-9 rounded-xl font-bold text-[11px] tracking-wide transition-all cursor-pointer",
                            themeMounted && theme === opt.value
                              ? "bg-emerald-500 text-white"
                              : "bg-canvas dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400",
                          )}
                        >
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Статуси QR — аз таби QR кӯчид ба ин ҷо (мисли native):
                      ба тарҳи стикер дахл надорад, бо кадом ранг кашида
                      шуданаш аҳамият надорад. */}
                  <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <QrCode className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {t("qrStatus")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowWhyQRModal(true)}
                          className="text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors underline decoration-dotted underline-offset-2 text-left"
                        >
                          {t("qrSecurityStatusWhy") || "Барои чӣ QR-код лозим аст?"}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleQrActive}
                      className={cn(
                        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        qrToggleOn ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          qrToggleOn ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Нест кардани ҳисоб — гурӯҳи алоҳида, то бо танзимоти
                  муқаррарӣ омехта нашавад (амали бебозгашт). Талаби
                  корбар: ранги ХОКИСТАРӢ (на сурх) — "Хуруҷ" акнун
                  сурхтарин аст. */}
              <div className="space-y-2">
                <div className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <Trash2 className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("deleteAccount")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                </div>
                <p className="text-[11px] font-medium text-zinc-400 px-4 leading-relaxed">
                  {t("deleteAccountDesc")}
                </p>
              </div>

              {/* Хуруҷ аз ҳисоб — талаби корбар: ПОЁНИ "Нест кардани
                  ҳисоб", ва рангаш аз он СУРХТАР. */}
              <div className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden">
                <SignOutButton>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <LogOut className="w-[18px] h-[18px] text-red-700 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-red-700">
                      {t("signOut")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-red-300 shrink-0" />
                  </button>
                </SignOutButton>
              </div>
            </div>
          </div>
        );

      case "saved":
        return (
          <div className="space-y-6">
            {/* Сарлавҳаи таби Захирашудаҳо */}
            <div className="sticky top-0 z-40 bg-canvas/80 backdrop-blur-md pt-4 pb-4 px-2.5 -mx-2.5 sm:px-4 sm:-mx-4 mb-6">
              <h3 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight">
                {t("savedItems")}
              </h3>
            </div>

            {/* Рӯйхати ашёҳои захирашуда */}
            <div className="">
              {savedLoading ? (
                <div className={ITEM_GRID_CLASS}>
                  {[...Array(3)].map((_, i) => (
                    <ItemCardSkeleton key={i} variant="profile" />
                  ))}
                </div>
              ) : savedItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {savedItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <Bookmark className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 text-xs min-[1084px]:text-sm tracking-widest">
                    {t("savedItemsEmpty")}
                  </h4>
                  <Button
                    asChild
                    size="sm"
                    className="mt-6 rounded-md font-bold text-[10px] min-[1084px]:text-[11px] tracking-wider"
                  >
                    <Link href="/">{t("home")}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 py-0 sm:py-8 min-h-[90vh]">
        {/* Mobile Profile Header (Instagram Style) */}
        {activeTab === "posts" && (
          <div className="block lg:hidden rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 pt-6 pb-6 mt-4 mb-4">
            <div className="flex items-center gap-6 mb-6">
              <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-zinc-100 dark:border-zinc-800 p-0.5">
                <AvatarImage
                  src={user?.imageUrl}
                  className="rounded-full object-cover"
                />
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-700 text-xl md:text-2xl font-bold">
                  {user?.firstName?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col gap-1">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none flex items-center gap-1.5">
                  {user?.firstName} {user?.lastName}
                  {profile?.is_verified && <VerifiedBadge />}
                </h2>
                <p className="text-xs md:text-sm font-bold text-zinc-500 truncate max-w-[200px] md:max-w-[260px]">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleTabChange("info")}
                className="flex-1 h-9 md:h-10 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] md:text-[11px] tracking-wider shadow-none"
              >
                <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-zinc-500" />
                {t("edit") || "Edit"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 h-9 md:h-10 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] md:text-[11px] tracking-wider shadow-none gap-2">
                    <MenuIcon className="w-4 h-4 md:w-[18px] md:h-[18px] text-zinc-500" />
                    {t("settings") || "Settings"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 md:w-60 rounded-xl shadow-xl p-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                >
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer font-bold text-[11px] md:text-xs tracking-wider text-zinc-700 dark:text-zinc-300"
                    >
                      <div
                        className={cn("p-1.5 rounded-md", item.bg, item.color)}
                      >
                        <item.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </div>
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => router.push("/admin")}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer font-bold text-[11px] md:text-xs tracking-wider text-zinc-700 dark:text-zinc-300"
                    >
                      <div className="p-1.5 text-zinc-500 dark:text-zinc-400">
                        <UserCog className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </div>
                      {t("adminPanel")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="p-0">
                    <SignOutButton>
                      <button className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-zinc-700 dark:text-zinc-300 font-bold text-[11px] tracking-wider">
                        <div className="p-1.5 text-zinc-500 dark:text-zinc-400">
                          <LogOut className="w-3.5 h-3.5" />
                        </div>
                        {t("signOut")}
                      </button>
                    </SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12 px-0 sm:px-0">
          {/* Менюи Sidebar (Менюи паҳлӯӣ) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-9 h-fit z-20 space-y-6">
              <div className="flex flex-col gap-3">
                {/* Тугмаи бозгашт ба саҳифаи асосӣ — талаби корбар: дар
                    сатри якуми меню, на танҳо тавассути навбари поёнӣ. */}
                <Link
                  href="/"
                  className="flex items-center justify-between p-3 min-[1084px]:p-3.5 min-[1503px]:p-4 rounded-xl transition-all group shadow-sm border bg-white border-zinc-100 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 min-[1084px]:p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 transition-colors">
                      <Home className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1503px]:w-5 min-[1503px]:h-5 min-[1920px]:w-[22px] min-[1920px]:h-[22px]" />
                    </div>
                    <span className="font-bold text-[10px] min-[1084px]:text-[11px] min-[1503px]:text-xs min-[1920px]:text-[13px] tracking-wider">
                      {t("home")}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1503px]:w-5 min-[1503px]:h-5 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "flex items-center justify-between p-3 min-[1084px]:p-3.5 min-[1503px]:p-4 rounded-xl transition-all group shadow-sm border",
                      activeTab === item.id
                        ? "bg-emerald-500 border-emerald-500 text-white scale-[1.02] shadow-md"
                        : "bg-white border-zinc-100 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 min-[1084px]:p-2.5 rounded-lg transition-colors",
                          activeTab === item.id
                            ? "bg-white/20 text-white"
                            : cn(item.bg, item.color),
                        )}
                      >
                        <item.icon className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1503px]:w-5 min-[1503px]:h-5 min-[1920px]:w-[22px] min-[1920px]:h-[22px]" />
                      </div>
                      <span className="font-bold text-[10px] min-[1084px]:text-[11px] min-[1503px]:text-xs min-[1920px]:text-[13px] tracking-wider">
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1503px]:w-5 min-[1503px]:h-5 transition-transform",
                        activeTab === item.id
                          ? "translate-x-1"
                          : "text-zinc-300 group-hover:translate-x-0.5",
                      )}
                    />
                  </button>
                ))}
              </div>

              {/* Тугмаи баромад (Log out) */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
                <SignOutButton>
                  <Button
                    variant="ghost"
                    className="w-full h-11 min-[1084px]:h-12 min-[1503px]:h-[52px] rounded-xl font-bold text-[10px] min-[1084px]:text-[11px] min-[1503px]:text-xs min-[1920px]:text-[13px] tracking-widest text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-all gap-2 justify-start px-4"
                  >
                    <LogOut className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1503px]:w-5 min-[1503px]:h-5" />
                    {t("signOut")}
                  </Button>
                </SignOutButton>
              </div>
            </div>
          </div>

          {/* Мӯҳтавои асосии табҳо */}
          <div className="lg:col-span-3">
            <div className="min-h-[60vh]">{renderContent()}</div>
          </div>
        </div>
      </div>

      {/* Модалкаи ҳатмии рақами телефон ва амният ҳангоми насби QR */}
      <Dialog
        open={showSecondaryPhoneModal}
        onOpenChange={setShowSecondaryPhoneModal}
      >
        <DialogContent className="sm:max-w-md rounded-3xl p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[100] max-h-[98vh] overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 px-8 pt-8 pb-4 space-y-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-1">
              <ShieldCheck className="w-8 h-8 text-zinc-500" />
            </div>

            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {t("qrSecondaryModal.title")}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 font-bold text-[11px] leading-relaxed">
                {t("qrSecondaryModal.desc")}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSaveSecondaryPhone}
              id="secondary-phone-form"
              className="space-y-6 text-left"
            >
              <div className="space-y-6">
                {/* Рақами асосӣ (агар набошад) */}
                {(!profile?.phone || profile.phone.trim() === "") && (
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                      {t("phoneLabel")}
                    </Label>
                    <PhoneInput
                      name="phone"
                      placeholder="XXXXXXXXX"
                      required
                    />
                  </div>
                )}

                {/* Рақами дуюм (агар набошад) */}
                {!profile?.secondary_phone && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.label")}
                      </Label>
                      <PhoneInput
                        name="secondary_phone"
                        placeholder={t("qrSecondaryModal.placeholder")}
                        className="text-emerald-600 dark:text-emerald-400"
                        required
                      />
                      <p className="text-[8px] font-bold text-zinc-400 px-1 leading-tight tracking-wider">
                        {t("phoneSecondaryDescription") ||
                          "Дар ҳолати гум шудани телефони шумо, ёбанда ба ин рақам занг мезанад."}
                      </p>
                    </div>

                  </>
                )}

                {/* Шабакаҳои иҷтимоӣ — ИХТИЁРӢ.
                    Пӯшида меистад, то формаи ҳатмиро дароз накунад. */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                    {t("qrSecondaryModal.socialBtn")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowSocial((v) => !v)}
                    aria-expanded={showSocial}
                    aria-label={t("qrSecondaryModal.socialBtn")}
                    className="w-full flex items-center justify-between gap-2 py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {/* Танҳо нишонаҳо, дар ранги брендии худ: чашм онҳоро
                        зудтар аз матн мешиносад. */}
                    <span className="flex items-center gap-3">
                      {SOCIALS.map(({ key, Icon }) => (
                        <Icon key={key} size={26} />
                      ))}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-zinc-400 transition-transform duration-300",
                        showSocial && "rotate-90",
                      )}
                    />
                  </button>

                  {showSocial && (
                    <div
                      className="space-y-2"
                      // Майдонҳо дар охири формаи ғилдиракдор меафтанд ва бе
                      // ин корбар танҳо тугмаи кушодашударо медид.
                      ref={(el) =>
                        el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                      }
                    >
                      {/* Ҳеҷ кадомашон ҳатмӣ нест — ин бояд ПЕШ аз майдонҳо
                          хонда шавад, вагарна корбар аллакай ҳар чорро пур
                          карда, баъд ишораро мебинад. */}
                      {/* Сабз, на хокистарӣ: ин ишора бояд ХОНДА шавад —
                          хокистарӣ дар байни майдонҳо гум мешуд. */}
                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 px-1 pb-1 leading-snug">
                        {t("qrSecondaryModal.socialPickHint")}
                      </p>
                      {SOCIALS.map(({ key, Icon, label }) => {
                        const prefix = socialPrefix(key, social[key]);
                        return (
                          <div key={key} className="relative">
                            <Icon
                              size={16}
                              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                            />
                            {/* Аломат ба қимат дохил намешавад — танҳо
                                намоишӣ. Ҷои он ҳамеша нигоҳ дошта мешавад
                                (`pl-[3.25rem]`), то ҳангоми пайдо шудани
                                он матн наҷаҳад. */}
                            <span
                              aria-hidden
                              className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400 pointer-events-none"
                            >
                              {prefix}
                            </span>
                            <Input
                              value={social[key]}
                              onChange={(e) =>
                                setSocial((s) => ({
                                  ...s,
                                  [key]: sanitizeSocialInput(key, e.target.value),
                                }))
                              }
                              placeholder={t(
                                `qrSecondaryModal.${key}Placeholder`,
                              )}
                              aria-label={label}
                              inputMode={key === "whatsapp" ? "numeric" : "text"}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              className="h-12 pl-[3.75rem] pr-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 font-bold text-sm border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Қабули шартҳо (агар қабул нашуда бошад) */}
                {profile?.accepted_terms !== true && (
                  <div className="flex items-start space-x-3 pt-2 px-1">
                    <Checkbox
                      id="terms-profile"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) =>
                        setAcceptedTerms(checked === true)
                      }
                      className="mt-1 border-2 border-zinc-200 dark:border-zinc-800 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-md transition-all duration-300"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="terms-profile"
                        className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed cursor-pointer select-none"
                      >
                        {t("terms.checkbox")}
                      </Label>
                      <button
                        type="button"
                        className="text-[9px] font-bold tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors text-left"
                        onClick={() => setShowTermsDetails(true)}
                      >
                        {t("terms.link")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="px-8 pb-8 pt-2">
            <Button
              type="submit"
              form="secondary-phone-form"
              className="w-full h-14 rounded-2xl font-bold tracking-[0.2em] text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 border-none"
              disabled={
                secondaryLoading ||
                (profile?.accepted_terms !== true && !acceptedTerms)
              }
            >
              {secondaryLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                t("saveAndDownload") || "Захира"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSecondaryPhoneModal(false)}
              className="w-full mt-2 text-[9px] font-bold tracking-widest text-zinc-400"
            >
              {t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms Details Dialog */}
      <Dialog open={showTermsDetails} onOpenChange={setShowTermsDetails}>
        <DialogContent className="w-[96%] sm:max-w-[400px] rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[110]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {t("terms.link")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed">
              {t("terms.content")}
            </p>
          </div>
          <Button
            onClick={() => setShowTermsDetails(false)}
            className="w-full h-12 rounded-xl font-bold tracking-widest text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
          >
            {t("ok")}
          </Button>
        </DialogContent>
      </Dialog>
      {/* Обои — хусусияти телефонӣ, дар веб танҳо шарҳ медиҳем. */}
      <Dialog open={showWallpaperInfoModal} onOpenChange={setShowWallpaperInfoModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-2 border border-zinc-100 dark:border-zinc-800">
              <Smartphone className="w-8 h-8 text-zinc-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("qrWallpaperWebTitle")}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-medium text-sm leading-relaxed">
              {/* Талаби корбар: "JUYO" (номи лотинӣ дар матни кириллӣ)
                  хурдтар аз бақияи ҷумла бошад — ба чашм намезад. */}
              {(() => {
                const desc = t("qrWallpaperWebDesc");
                const [before, after] = desc.split("JUYO");
                if (after === undefined) return desc;
                return (
                  <>
                    {before}
                    <span className="text-[11px]">JUYO</span>
                    {after}
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setShowWallpaperInfoModal(false)}
            className="w-full h-12 rounded-xl font-bold tracking-widest text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
          >
            {t("ok")}
          </Button>
        </DialogContent>
      </Dialog>
      {/* Why QR Modal */}
      <Dialog open={showWhyQRModal} onOpenChange={setShowWhyQRModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-8 h-8 text-zinc-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("qrWhyGuideTitle") || "Чӣ тавр QR-код ба шумо кӯмак мекунад?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed space-y-4 text-left mt-4">
                <p className="text-center mb-6">
                  {t("qrWhyGuideDesc") ||
                    "Ин стикери махсусест, ки ашёҳои шуморо муҳофизат мекунад. Тарзи кораш хеле оддӣ аст:"}
                </p>

                <div className="space-y-5 mt-4 bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-bold text-zinc-900 dark:text-white text-xs">
                        1
                      </span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-bold text-[11px] tracking-wider text-emerald-600 dark:text-emerald-400">
                        {t("qrWhyStep1Title") || "Дизайн ва скачат кунед"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep1Desc") ||
                          "Аввал QR-кодро бо услуби худ дизайн кунед, сипас онро скачат карда, чоп кунед ва ба ашёҳоятон часпонед."}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-bold text-zinc-900 dark:text-white text-xs">
                        2
                      </span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-bold text-[11px] tracking-wider text-emerald-600 dark:text-emerald-400">
                        {t("qrWhyStep2Title") || "Ёбанда скан мекунад"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep2Desc") ||
                          "Ашё гум шавад, шахси ёфтагӣ танҳо камераи телефонашро ба QR-код наздик мекунад."}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-bold text-zinc-900 dark:text-white text-xs">
                        3
                      </span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-bold text-[11px] tracking-wider text-emerald-600 dark:text-emerald-400">
                        {t("qrWhyStep3Title") || "Алоқаи фаврӣ ва бехатар"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep3Desc") ||
                          "Саҳифаи шумо кушода мешавад ва ёбанда бевосита ба шумо занг мезанад. Рақамҳои эҳтиётӣ низ дастрас мешаванд."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 flex flex-col gap-2">
            <Button
              onClick={() => setShowWhyQRModal(false)}
              className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
            >
              {t("ok") || "Фаҳмо"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Account Confirmation Modal */}
      <ConfirmDialog
        open={showDeleteAccountModal}
        onOpenChange={(open) =>
          !deletingAccount && setShowDeleteAccountModal(open)
        }
        icon={Trash2}
        variant="destructive"
        title={t("deleteAccountConfirmTitle")}
        description={t("deleteAccountConfirmDesc")}
        confirmLabel={t("deleteAccount")}
        cancelLabel={t("cancel")}
        onConfirm={handleDeleteAccount}
        loading={deletingAccount}
      />

      {/* Change Password Modal */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-8 h-8 text-zinc-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("changePassword")}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
              {t("changePasswordDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Мисоли аксӣ — саҳифаи воридшавӣ бо ишора ба "Рамзро фаромӯш кардед?" */}
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-2.5">
            <div className="text-center space-y-0.5 mb-2">
              <p className="font-bold text-[11px] text-zinc-900 dark:text-white">
                {t("clerk.signInTitle")}
              </p>
              <p className="text-[8px] font-bold text-zinc-400">
                {t("clerk.signInSubtitle")}
              </p>
            </div>
            <div className="h-7 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700" />
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="text-[8px] font-bold text-zinc-300">{t("clerk.dividerText")}</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-bold text-zinc-400 ml-1">{t("clerk.emailLabel")}</span>
              <div className="h-7 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <span className="text-[8px] font-bold text-zinc-400">{t("clerk.signInPasswordLabel")}</span>
                <span className="relative text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md ring-2 ring-emerald-400">
                  {t("clerk.forgotPasswordLabel")}
                  <MousePointerClick className="w-3.5 h-3.5 absolute -bottom-3.5 -right-2.5 text-emerald-500 rotate-[-8deg]" />
                </span>
              </div>
              <div className="h-7 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="h-8 rounded-lg bg-zinc-900 dark:bg-white mt-1" />
          </div>

          <div className="mt-8">
            <SignOutButton>
              <Button className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-red-500 text-white hover:bg-red-600 transition-all gap-2">
                <LogOut className="w-4 h-4" />
                {t("signOutToChangePassword")}
              </Button>
            </SignOutButton>
          </div>
          <Button
            variant="ghost"
            onClick={() => setShowChangePasswordModal(false)}
            className="w-full h-11 rounded-xl font-bold tracking-widest text-[10px] text-zinc-500 mt-2"
          >
            {t("cancel")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Email Change Modal */}
      <Dialog
        open={showEmailChangeModal}
        onOpenChange={(open) =>
          // Дар зинаи ворид кардани рамз, click-и тасодуфӣ ба берун модалро
          // напӯшонад — почта аллакай сохта/тасдиқшуда аст, гум кардани
          // ин ҳолат боиси "почта аллакай гирифта шудааст" мешавад ҳангоми
          // такрор. Танҳо тугмаи "Бекор кардан" метавонад пӯшад.
          !emailSubmitting &&
          emailStep !== "verify" &&
          (open ? setShowEmailChangeModal(true) : resetEmailModal())
        }
      >
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <Mail className="w-8 h-8 text-zinc-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("changeEmail")}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
              {emailStep === "input"
                ? t("changeEmailDesc")
                : t("changeEmailVerifyDesc")}
            </DialogDescription>
          </DialogHeader>

          {emailStep === "input" ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                  {t("newEmail")}
                </Label>
                <Input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="example@mail.com"
                  className="h-11 rounded-xl font-bold text-sm"
                  required
                />
              </div>
              <Button
                onClick={handleStartEmailChange}
                disabled={emailSubmitting || !newEmailInput}
                className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
              >
                {emailSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("sendCode")
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                  {t("verificationCode")}
                </Label>
                <Input
                  inputMode="numeric"
                  value={emailCodeInput}
                  onChange={(e) =>
                    setEmailCodeInput(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="000000"
                  className="h-11 rounded-xl font-bold text-sm text-center tracking-[0.3em]"
                  maxLength={6}
                  required
                />
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-2xl border border-amber-100 dark:border-amber-900/40 font-bold text-xs leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t("checkSpamFolderHint")}</span>
              </div>
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <span className="text-[11px] font-bold text-zinc-400">
                    {t("resendCodeIn", { seconds: resendCooldown })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendSubmitting}
                    className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {resendSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("resendCodeAction")}
                  </button>
                )}
              </div>
              <Button
                onClick={handleVerifyEmailChange}
                disabled={emailSubmitting || emailCodeInput.length < 6}
                className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
              >
                {emailSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("confirm")
                )}
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            disabled={emailSubmitting}
            onClick={resetEmailModal}
            className="w-full h-11 rounded-xl font-bold tracking-widest text-[10px] text-zinc-500 mt-2"
          >
            {t("cancel")}
          </Button>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
}

/**
 * Саҳифаи асосии Профил бо Suspense
 */
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 pb-32 px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
            <Skeleton className="aspect-square w-full max-w-sm mx-auto rounded-[2rem]" />
            <div className="space-y-5">
              <Skeleton className="h-10 w-40 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
