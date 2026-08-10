/**
 * Ин саҳифаи Профили корбар ҳаст.
 * Дар ин ҷо корбар метавонад эълонҳои худро идора кунад, маълумоти шахсиашро иваз кунад,
 * ва QR-коди худро созад.
 */ "use client";

import { useEffect, useState, useRef, Suspense } from "react"; // Барои идоракунии вақт, ҳолат ва боргирии саҳифа
import dynamic from "next/dynamic";
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs"; // Барои кор бо маълумоти корбари воридшуда ва баромад аз сайт
import { useLanguage } from "@/lib/language-context"; // Барои идоракунии забони интерфейс
import { translations } from "@/lib/translations"; // Барои қисми "guide.qrItems" (рӯйхат, на матни оддӣ)
import { ITEM_GRID_CLASS } from "@/lib/ui-constants";
import { Profile, ProfileService } from "@/lib/services/profile-service"; // Барои идоракунии маълумоти шахсии корбар
import { ItemCard } from "@/components/item-card"; // Барои нишон додани карточкаҳои эълонҳо
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Барои нишон додани сурати корбар
import { Skeleton } from "@/components/ui/skeleton"; // Барои ҳолати боргирии муваққатӣ
import { Input } from "@/components/ui/input"; // Майдони воридкунии матн
import { Label } from "@/components/ui/label"; // Сарлавҳаҳо барои майдонҳои форма
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Рӯйхати интихобшаванда
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба базаи Supabase
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
  Phone,
  Pencil,
  QrCode,
  Menu as MenuIcon,
  Download,
  RefreshCw,
  Palette,
  Search,
  KeyRound,
  MousePointerClick,
  UserX,
  Globe,
  UserCog,
} from "lucide-react";
// Иконкаҳои гуногун барои интерфейс
import Link from "next/link"; // Барои пайвандҳо ба саҳифаҳои дигар
import { useRouter, useSearchParams } from "next/navigation"; // Барои идоракунии адрес ва параметрҳои URL
import { cn } from "@/lib/utils"; // Барои пайваст кардани классҳои CSS
import { toast } from "sonner"; // Барои нишон додани огоҳиномаҳо
import {
  TooltipProvider,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳои кӯтоҳ
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои тасдиқкунанда (модалкаҳо)
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

// Клерк одатан хатогиро ҳамчун { errors: [{ longMessage, message }] } мефиристад —
// ин helper новобаста аз шакли воқеии хатогӣ (Clerk, Error, ё дигар) паёми
// хониданиро бе `any` мебарорад.
function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const clerkErr = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
    return clerkErr.errors?.[0]?.longMessage || clerkErr.errors?.[0]?.message || clerkErr.message || fallback;
  }
  return fallback;
}

function ProfileContent() {
  // Хукҳо барои гирифтани маълумоти корбар ва забони сайт
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Стейтҳо барои идоракунии табҳо (вкладки) ва танзимоти QR
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "posts",
  );
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePicker, setActivePicker] = useState<"qr" | "bg" | "all" | null>(
    null,
  );
  const [showWhyQRModal, setShowWhyQRModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
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
      toast.error(getClerkErrorMessage(err, t("error")));
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
      toast.error(getClerkErrorMessage(err, t("error")));
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
      toast.error(getClerkErrorMessage(err, t("error")));
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
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondaryType, setSecondaryType] = useState<string>("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsDetails, setShowTermsDetails] = useState(false);

  // Стейт барои танзимоти намуди зоҳирии QR-код (рангҳо ва текст)
  const [qrSettings, setQrSettings] = useState({
    qrColor: "#26ba90",
    bgColor: "#eefbf5",
    text: t("qrScanMe"),
    dotsType: "extra-rounded" as DotType,
    cornersSquareType: "dot" as CornerSquareType,
    cornersDotType: "dot" as CornerDotType,
  });

  // Токен барои Supabase — лозим барои useUserItems/useSavedItems ва
  // амалиётҳои дигар (иваз кардани email, аватар ва ғ.) дар ин саҳифа.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    getToken({ template: "supabase" })
      .then((t) => { if (t) setToken(t); })
      .catch((err) => console.error("Error loading token:", err));
  }, [userId, getToken]);

  // Рӯйхати корбарони block-шуда (барои таби "Маълумоти шахсӣ")
  const [blockedUsers, setBlockedUsers] = useState<
    { user_id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]
  >([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    supabase.rpc("get_my_blocked_users").then(({ data }) => {
      if (data) setBlockedUsers(data);
    });
  }, [token]);

  const handleUnblockUser = async (targetUserId: string) => {
    if (unblockingId) return;
    setUnblockingId(targetUserId);
    try {
      const supabase = createClerkSupabaseClient(token!);
      const { error } = await supabase.rpc("unblock_user", { p_user_id: targetUserId });
      if (error) throw error;
      setBlockedUsers((prev) => prev.filter((u) => u.user_id !== targetUserId));
      toast.success(t("success"));
    } catch {
      toast.error(t("error"));
    } finally {
      setUnblockingId(null);
    }
  };

  // Профил — тавассути React Query (кэши 2 дақиқа), на бо fetch-и дастии
  // бе кэш — пеш аз ин ҳар гузариш ба /profile (масалан home → QR →
  // бозгашт) skeleton-и наверо нишон медод, ҳатто агар чанд сония пеш
  // аллакай fetch шуда буд.
  const { data: queriedProfile, isError: profileQueryError } = useProfileQuery(userId, token);
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
    token,
  );
  const { data: savedItems = [], isLoading: savedLoading } = useSavedItems(
    userId || undefined,
    token,
  );
  const [infoSubmitting, setInfoSubmitting] = useState(false);
  // Табҳои "Танзимот" ба сабки рӯйхати iOS сохта шудаанд — маълумоти шахсӣ
  // ва рӯйхати корбарони басташуда ба ҷои ҳамеша кушода будан, бо клик
  // ба сатри худашон боз/пӯшида мешаванд.
  const [openSetting, setOpenSetting] = useState<"profile" | "blocked" | null>(null);

  // Синхронизатсия кардани таби фаъол бо URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab &&
      ["posts", "info", "saved", "qr", "guide"].includes(tab)
    ) {
      setActiveTab(tab);
    }
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

  // Стейт барои тирезаи тасдиқи амалҳо (Confirm Dialog)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "destructive" | "warning";
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  });

  // Элементҳои менюи паҳлӯӣ (Sidebar Menu)
  const LANGUAGES: Array<{ code: "tg" | "ru" | "en"; label: string }> = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  // Ҳамаи icon-ҳои меню як ранг (emerald) доранд — рангҳои гуногун
  // (кабуд/бунафш/индиго) маънои алоҳида надоштанд ва танҳо оройиш буданд.
  const menuItems = [
    {
      id: "posts",
      title: t("myPosts"),
      icon: LayoutGrid,
      color: "text-zinc-500",
      bg: "bg-white dark:bg-zinc-900",
    },
    {
      id: "info",
      title: t("settings"),
      icon: Settings,
      color: "text-zinc-500",
      bg: "bg-white dark:bg-zinc-900",
    },
    {
      id: "qr",
      title: t("qrMyCode"),
      icon: QrCode,
      color: "text-zinc-500",
      bg: "bg-white dark:bg-zinc-900",
    },
    {
      id: "saved",
      title: t("savedItems"),
      icon: Bookmark,
      color: "text-zinc-500",
      bg: "bg-white dark:bg-zinc-900",
    },
    {
      id: "guide",
      title: t("aboutApp"),
      icon: MenuIcon,
      color: "text-zinc-500",
      bg: "bg-white dark:bg-zinc-900",
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
   * Функсия барои боргирии QR-код ҳамчун сурат (Download)
   */
  const handleDownloadQR = async () => {
    const isMissingData =
      !profile?.phone ||
      !profile?.secondary_phone ||
      !profile?.secondary_phone_type ||
      profile?.accepted_terms !== true;

    if (isMissingData) {
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
    const needsSecondary =
      !profile?.secondary_phone || !profile?.secondary_phone_type;
    const needsTerms = profile?.accepted_terms !== true;

    if (needsTerms && !acceptedTerms) {
      toast.error(t("terms.error") || "Лутфан шартҳоро қабул кунед");
      return;
    }

    if (needsSecondary && !secondaryType) {
      toast.error(t("fillAllFields"));
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
      const supabaseToken = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(supabaseToken!);

      const updates: Partial<Profile> = {};
      if (needsPhone) updates.phone = phone;
      if (needsSecondary) {
        updates.secondary_phone = secondary_phone;
        updates.secondary_phone_type = secondaryType;
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

      // Пас аз захира, мустақиман боргириро иҷро мекунем бе тафтиши иловагӣ
      await executeQRDownload();
    } catch (err) {
      console.error("Error saving profile setup:", err);
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
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
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
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
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
          <div className="space-y-8 pb-32">
            {/* Танзимоти намуди зоҳирии QR */}
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start px-2">
                {/* Пешнамоиши QR (Preview) */}
                {/* Сутуни пешнамоиш. Танҳо ХУДИ QR sticky аст — корти
                    статус, тугмаҳо ва танзимот аз таги он мегузаранд. */}
                <div className="flex flex-col">
                <div className="sticky top-[60px] sm:top-[130px] z-30 md:relative md:top-0 bg-canvas/80 backdrop-blur-md -mx-4 px-1.5 py-1 md:p-0 md:bg-transparent md:backdrop-blur-none transition-all duration-300">
                  <div className="relative group bg-transparent sm:bg-canvas rounded-xl md:rounded-[3rem] p-0 sm:p-8 md:p-12 flex items-center justify-center border-0 sm:border-2 sm:border-dashed border-zinc-200 dark:border-zinc-800 w-full sm:max-w-sm mx-auto overflow-hidden shadow-none sm:shadow-sm md:shadow-none transition-all duration-300">
                    <div className="scale-[0.78] min-[768px]:scale-90 min-[1084px]:scale-100 min-[1503px]:scale-105 origin-center transition-transform duration-300 shrink-0">
                      <QRCard
                        id={user?.id || ""}
                        settings={{
                          qrColor: qrSettings.qrColor,
                          bgColor: qrSettings.bgColor,
                          borderRadius: "medium",
                          shadow: "soft",
                          hasBorder: false,
                          pattern: "none",
                          text: qrSettings.text,
                          dotsType: qrSettings.dotsType,
                          cornersSquareType: qrSettings.cornersSquareType,
                          cornersDotType: qrSettings.cornersDotType,
                        }}
                        className="qr-card-mobile-hide-text"
                        innerRef={qrRef}
                      />
                    </div>
                  </div>
                </div>

                {/* Статус ва тугмаҳо — берун аз sticky, то бо танзимоти
                    поён якҷоя аз таги QR гузаранд. px-1 = ҳамон падинги
                    сутуни танзимот, то паҳноияшон баробар бошад. */}
                <div className="mt-4 w-full px-1">
                    <div className="bg-white dark:bg-zinc-900 border-none shadow-none p-4 min-[1084px]:p-5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs min-[1084px]:text-sm font-bold tracking-wide text-zinc-900 dark:text-white">
                            {t("qrStatus")}
                          </span>
                          <button
                            onClick={() => setShowSecurityModal(true)}
                            className="text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors underline decoration-dotted underline-offset-2 text-left"
                          >
                            {t("qrSecurityStatusWhy") ||
                              "Барои чӣ QR-код статус лозим?"}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!profile) return;
                          const previousState = profile.is_qr_active;
                          const newState = !previousState;

                          // Optimistic update
                          setProfile({ ...profile, is_qr_active: newState });

                          try {
                            const token = await getToken({
                              template: "supabase",
                            });
                            const supabase = createClerkSupabaseClient(token!);

                            // Background update
                            ProfileService.updateProfile(supabase, userId!, {
                              is_qr_active: newState,
                            })
                              .then((updated) => {
                                setProfile(updated);
                                toast.success(
                                  newState
                                    ? t("qrActivatedSuccess")
                                    : t("qrDeactivatedSuccess"),
                                );
                              })
                              .catch((err) => {
                                console.error(err);
                                setProfile({
                                  ...profile,
                                  is_qr_active: previousState,
                                });
                                toast.error(t("error"));
                              });
                          } catch (err) {
                            console.error(err);
                            setProfile({
                              ...profile,
                              is_qr_active: previousState,
                            });
                            toast.error(t("error"));
                          }
                        }}
                        className={cn(
                          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          profile?.is_qr_active
                            ? "bg-emerald-500"
                            : "bg-zinc-300 dark:bg-zinc-700",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            profile?.is_qr_active
                              ? "translate-x-5"
                              : "translate-x-0",
                          )}
                        />
                      </button>
                    </div>
                  </div>

                {/* Тугмаҳои амалиёт — низ берун аз sticky */}
                <div className="grid grid-cols-2 gap-3 mt-3 w-full px-1">
                  <Button
                    onClick={() => setShowWhyQRModal(true)}
                    className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none text-zinc-500 dark:text-zinc-400 font-bold text-[11px] min-[1084px]:text-xs tracking-normal hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all gap-1.5 px-2.5"
                  >
                    {t("qrSecurityQuestion") || "Барои чӣ лозим?"}
                  </Button>
                  <Button
                    onClick={handleDownloadQR}
                    disabled={isDownloading}
                    className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none text-zinc-500 dark:text-zinc-400 font-bold text-[11px] min-[1084px]:text-xs tracking-normal hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all gap-1.5 px-2.5"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 min-[1084px]:w-[18px] min-[1084px]:h-[18px] text-emerald-500" />
                    )}
                    {t("download")}
                  </Button>
                </div>
                </div>

                {/* Панели танзимоти QR - Full Width ва Compact */}
                <div className="space-y-5 px-1 pb-10">
                  {/* Стил ва Шаклҳо */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 ml-1">
                        <LayoutGrid className="w-3 h-3 text-zinc-400" />
                        <Label className="text-xs font-bold text-zinc-500">
                          {t("qrDotsStyle") || "Нуқтаҳо"}
                        </Label>
                      </div>
                      <Select
                        value={qrSettings.dotsType}
                        onValueChange={(val) =>
                          setQrSettings({ ...qrSettings, dotsType: val as DotType })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none text-sm font-bold px-3.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800">
                          <SelectItem value="square">
                            {t("qrDotSquare")}
                          </SelectItem>
                          <SelectItem value="dots">{t("qrDotDots")}</SelectItem>
                          <SelectItem value="rounded">
                            {t("qrDotRounded")}
                          </SelectItem>
                          <SelectItem value="extra-rounded">
                            {t("qrDotExtraRounded")}
                          </SelectItem>
                          <SelectItem value="classy">
                            {t("qrDotClassy")}
                          </SelectItem>
                          <SelectItem value="classy-rounded">
                            {t("qrDotClassyRounded")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 ml-1">
                        <RefreshCw className="w-3 h-3 text-zinc-400" />
                        <Label className="text-xs font-bold text-zinc-500">
                          {t("qrCornersStyle") || "Кунҷҳо"}
                        </Label>
                      </div>
                      <Select
                        value={qrSettings.cornersSquareType}
                        onValueChange={(val) => {
                          const cornerStyle = val as CornerSquareType;
                          const dotStyle: CornerDotType =
                            cornerStyle === "square" ? "square" : "dot";
                          setQrSettings({
                            ...qrSettings,
                            cornersSquareType: cornerStyle,
                            cornersDotType: dotStyle,
                          });
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none text-sm font-bold px-3.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800">
                          <SelectItem value="square">
                            {t("qrCornerSquare")}
                          </SelectItem>
                          <SelectItem value="dot">
                            {t("qrCornerDot")}
                          </SelectItem>
                          <SelectItem value="extra-rounded">
                            {t("qrCornerRounded")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Рангҳо */}
                  <div className="grid grid-cols-2 gap-3 relative">
                    <div className="space-y-2 relative">
                      <div className="flex items-center gap-1.5 ml-1">
                        <Palette className="w-3 h-3 text-zinc-400" />
                        <Label className="text-xs font-bold text-zinc-500">
                          {t("qrColorLabel")}
                        </Label>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePicker(activePicker === "qr" ? null : "qr");
                        }}
                        className="w-full h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none p-1 flex items-center gap-3 transition-all color-trigger px-2 hover:bg-zinc-50"
                      >
                        <div
                          className="w-7 h-7 rounded-xl border border-black/10"
                          style={{ backgroundColor: qrSettings.qrColor }}
                        />
                        <span className="font-mono text-xs font-bold text-zinc-500">
                          {qrSettings.qrColor}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-2 relative">
                      <Label className="text-xs font-bold text-zinc-500 ml-1">
                        {t("qrBgLabel")}
                      </Label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePicker(activePicker === "bg" ? null : "bg");
                        }}
                        className="w-full h-11 rounded-2xl bg-white dark:bg-zinc-900 border-none shadow-none p-1 flex items-center gap-3 transition-all color-trigger px-2 hover:bg-zinc-50"
                      >
                        <div
                          className="w-7 h-7 rounded-xl border border-black/10"
                          style={{ backgroundColor: qrSettings.bgColor }}
                        />
                        <span className="font-mono text-xs font-bold text-zinc-500">
                          {qrSettings.bgColor}
                        </span>
                      </button>
                    </div>

                    {(activePicker === "qr" || activePicker === "bg") && (
                      <div className="fixed inset-x-0 bottom-[56px] sm:bottom-auto sm:absolute sm:inset-0 z-40 sm:z-[60] p-0 bg-white dark:bg-zinc-950 sm:rounded-[2rem] shadow-2xl border-t sm:border border-zinc-100 dark:border-zinc-800 color-picker-container overflow-hidden">
                        <div className="flex flex-row p-0 gap-0 justify-center items-stretch h-full">
                          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950">
                            <div className="p-0 flex justify-center flex-1 items-center">
                              <HexColorPicker
                                color={qrSettings.qrColor}
                                onChange={(color) =>
                                  setQrSettings({
                                    ...qrSettings,
                                    qrColor: color,
                                  })
                                }
                                className="!w-full !h-48 sm:!w-[180px] sm:!h-[180px]"
                              />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 border-l border-zinc-100 dark:border-zinc-800">
                            <div className="p-0 flex justify-center flex-1 items-center">
                              <HexColorPicker
                                color={qrSettings.bgColor}
                                onChange={(color) =>
                                  setQrSettings({
                                    ...qrSettings,
                                    bgColor: color,
                                  })
                                }
                                className="!w-full !h-48 sm:!w-[180px] sm:!h-[180px]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 pb-8 sm:pb-4 border-t border-zinc-100 dark:border-zinc-800">
                          <Button
                            className="w-full h-12 sm:h-12 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
                            onClick={() => setActivePicker(null)}
                          >
                            {t("done")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Текст */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-zinc-400 tracking-widest ml-1">
                      {t("qrFooterText")}
                    </Label>
                    <Input
                      value={qrSettings.text}
                      onChange={(e) =>
                        setQrSettings({
                          ...qrSettings,
                          text: e.target.value,
                        })
                      }
                      className="h-12 rounded-xl bg-white dark:bg-zinc-900 border-none shadow-none font-bold text-sm focus-visible:ring-2 focus-visible:ring-zinc-200"
                      placeholder={t("qrInputPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "guide":
        return (
          <div className="space-y-8 pb-20">
            <div className="sticky top-0 sm:top-[64px] z-40 bg-canvas/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4">
              <h3 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight">
                {t("aboutApp") || "Оид ба JUYU"}
              </h3>
            </div>

            <div className="space-y-10 px-2">
              {/* Mission */}
              <section className="space-y-6">
                <div className="bg-zinc-900 text-white p-8 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
                  <h4 className="text-2xl font-bold tracking-tight mb-4 relative z-10">
                    {t("guide.problemTitle")}
                  </h4>
                  <div className="text-zinc-400 font-bold leading-relaxed relative z-10 space-y-4">
                    <p>{t("guide.problemDesc")}</p>
                  </div>
                </div>
              </section>

              {/* Solution */}
              <section className="space-y-6">
                <h4 className="text-2xl font-bold tracking-tight px-4">
                  {t("guide.solutionTitle")}
                </h4>
                <div className="bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 p-8 rounded-3xl space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-400 font-bold">
                    {t("guide.solutionDesc1")}
                    <span className="text-emerald-600">
                      {t("guide.solutionDesc2")}
                    </span>
                    {t("guide.solutionDesc3")}
                    <span className="text-red-600">
                      {t("guide.solutionDesc4")}
                    </span>
                    {t("guide.solutionDesc5")}
                  </p>
                </div>
              </section>

              {/* How it works */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 rounded-3xl bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center">
                    <PackageSearch className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h5 className="font-bold text-sm tracking-wider">
                    {t("guide.foundTitle")}
                  </h5>
                  <ol className="text-[12px] text-zinc-500 font-medium leading-relaxed space-y-2 list-decimal list-inside">
                    <li>{t("guide.foundStep1")}</li>
                    <li>{t("guide.foundStep2")}</li>
                    <li>{t("guide.foundStep3")}</li>
                  </ol>
                </div>

                <div className="p-8 rounded-3xl bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                    <Search className="w-6 h-6 text-red-600" />
                  </div>
                  <h5 className="font-bold text-sm tracking-wider">
                    {t("guide.lostTitle")}
                  </h5>
                  <ol className="text-[12px] text-zinc-500 font-medium leading-relaxed space-y-2 list-decimal list-inside">
                    <li>{t("guide.lostStep1")}</li>
                    <li>{t("guide.lostStep2")}</li>
                    <li>{t("guide.lostStep3")}</li>
                  </ol>
                </div>
              </div>

              {/* QR System */}
              <section className="space-y-6">
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-8 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
                  <h4 className="text-2xl font-bold tracking-tight mb-4 relative z-10">
                    {t("guide.qrSystemTitle")}
                  </h4>
                  <p className="text-zinc-400 font-bold mb-8 relative z-10">
                    {t("guide.qrSystemDesc")}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                    {((translations[locale]?.guide as { qrItems: string[] } | undefined)?.qrItems ?? []).map((item, i) => (
                      <div
                        key={i}
                        className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl text-center border border-white/10"
                      >
                        <p className="text-[10px] font-bold tracking-widest text-zinc-300">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 relative z-10">
                    <h5 className="font-bold text-xs tracking-[0.2em] text-emerald-400">
                      {t("guide.qrHowTitle")}
                    </h5>
                    <ul className="space-y-3">
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-bold">1.</span>
                        {t("guide.qrHowStep1")}
                      </li>
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-bold">2.</span>
                        {t("guide.qrHowStep2")}
                      </li>
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-bold">3.</span>
                        {t("guide.qrHowStep3")}
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 flex justify-center relative z-10">
                    <div className="bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-2xl border border-emerald-500/20 font-bold text-[10px] tracking-widest">
                      {t("guide.qrAdvantage")}
                    </div>
                  </div>
                </div>
              </section>

              {/* Goal */}
              <div className="grid grid-cols-1 gap-6 pb-12">
                <div className="p-8 rounded-3xl bg-zinc-900 text-white space-y-4">
                  <h5 className="font-bold text-sm tracking-wider text-emerald-400">
                    {t("guide.mainGoalTitle")}
                  </h5>
                  <p className="text-sm text-zinc-400 font-bold leading-relaxed">
                    {t("guide.mainGoalDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="pb-20">
            {/* Сарлавҳаи таби Танзимот */}
            <div className="sticky top-0 sm:top-[64px] z-40 bg-canvas/80 backdrop-blur-md pt-4 pb-4 px-4 mb-4 -mx-4">
              <h3 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight">
                {t("settings")}
              </h3>
            </div>

            <div className="max-w-2xl px-2 space-y-6">
              {/* Корти профил — аватар, ном, почта */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 flex items-center gap-4">
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
                <div className="bg-white dark:bg-zinc-900 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
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

                      setInfoSubmitting(true);
                      try {
                        // Ном/насаб ва рақамҳоро аз сервер (Backend API)
                        // иваз мекунем — то бо ҳисобҳои бе parol (масалан
                        // бо Google) ба хатогии "first_name is not a
                        // valid parameter" ё reverification дучор нашавем.
                        const res = await fetch("/api/account/update-profile", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ firstName, lastName, phone, secondaryPhone }),
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
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input
                            name="phone"
                            placeholder={t("phonePlaceholder")}
                            defaultValue={profile?.phone || ""}
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) =>
                              (e.target.value = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                              ))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                          {t("phoneSecondaryLabel")}
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input
                            name="secondaryPhone"
                            placeholder={t("phoneSecondaryPlaceholder")}
                            defaultValue={profile?.secondary_phone || ""}
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) =>
                              (e.target.value = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                              ))
                            }
                          />
                        </div>
                      </div>
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
                <div className="bg-white dark:bg-zinc-900 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
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
                              : "bg-canvas dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
                          )}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Корбарони басташуда — танҳо агар мавҷуд бошанд */}
                  {blockedUsers.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenSetting(openSetting === "blocked" ? null : "blocked")}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                      >
                        <UserX className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {t("blockedUsers")}
                        </span>
                        <span className="text-xs font-medium text-zinc-400">
                          {blockedUsers.length}
                        </span>
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 text-zinc-400 shrink-0 transition-transform",
                            openSetting === "blocked" && "rotate-90",
                          )}
                        />
                      </button>
                      {openSetting === "blocked" &&
                        blockedUsers.map((u) => (
                          <div key={u.user_id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={u.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-canvas dark:bg-zinc-800 text-xs">
                                  <User className="w-4 h-4 text-zinc-400" />
                                </AvatarFallback>
                              </Avatar>
                              <p className="font-medium text-sm truncate">
                                {u.first_name || t("user")} {u.last_name || ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unblockingId === u.user_id}
                              onClick={() => handleUnblockUser(u.user_id)}
                              className="h-9 rounded-lg border-none shadow-none bg-canvas dark:bg-zinc-800 font-bold text-[9px] tracking-widest shrink-0"
                            >
                              {unblockingId === u.user_id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                t("unblockUser")
                              )}
                            </Button>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </div>

              {/* Нест кардани ҳисоб — гурӯҳи алоҳида, то бо танзимоти
                  муқаррарӣ омехта нашавад (амали бебозгашт). */}
              <div className="space-y-2">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <Trash2 className="w-[18px] h-[18px] text-red-600 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-red-600">
                      {t("deleteAccount")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-red-300 shrink-0" />
                  </button>
                </div>
                <p className="text-[11px] font-medium text-zinc-400 px-4 leading-relaxed">
                  {t("deleteAccountDesc")}
                </p>
              </div>
            </div>
          </div>
        );

      case "saved":
        return (
          <div className="space-y-6">
            {/* Сарлавҳаи таби Захирашудаҳо */}
            <div className="sticky top-0 sm:top-[64px] z-40 bg-canvas/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight">
                  {t("savedItems")}
                </h3>
                <div className="px-2 min-[1084px]:px-2.5 py-0.5 rounded text-[10px] min-[1084px]:text-xs min-[1503px]:text-sm font-bold bg-zinc-900 text-white">
                  {savedItems.length}
                </div>
              </div>
            </div>

            {/* Рӯйхати ашёҳои захирашуда */}
            <div className="">
              {savedLoading ? (
                <div className={ITEM_GRID_CLASS}>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : savedItems.length > 0 ? (
                <div className={ITEM_GRID_CLASS}>
                  {savedItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
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
      <div className="w-full px-3 sm:px-4 py-0 sm:py-8 min-h-[90vh]">
        {/* Mobile Profile Header (Instagram Style) */}
        {activeTab === "posts" && (
          <div className="block lg:hidden rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 pt-6 pb-6 mt-4 mb-4">
            <div className="flex items-center gap-6 mb-6">
              <Avatar className="w-20 h-20 min-[768px]:w-24 min-[768px]:h-24 border-2 border-zinc-100 dark:border-zinc-800 p-0.5">
                <AvatarImage
                  src={user?.imageUrl}
                  className="rounded-full object-cover"
                />
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-xl min-[768px]:text-2xl font-bold">
                  {user?.firstName?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col gap-1">
                <h2 className="text-xl min-[768px]:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none flex items-center gap-1.5">
                  {user?.firstName} {user?.lastName}
                  {profile?.is_verified && <VerifiedBadge />}
                </h2>
                <p className="text-xs min-[768px]:text-sm font-bold text-zinc-500 truncate max-w-[200px] min-[768px]:max-w-[260px]">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleTabChange("info")}
                className="flex-1 h-9 min-[768px]:h-10 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] min-[768px]:text-[11px] tracking-wider shadow-none"
              >
                <Pencil className="w-3.5 h-3.5 min-[768px]:w-4 min-[768px]:h-4 mr-2 text-zinc-500" />
                {t("edit") || "Edit"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 h-9 min-[768px]:h-10 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] min-[768px]:text-[11px] tracking-wider shadow-none gap-2">
                    <MenuIcon className="w-4 h-4 min-[768px]:w-[18px] min-[768px]:h-[18px] text-zinc-500" />
                    {t("settings") || "Settings"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 min-[768px]:w-60 rounded-xl shadow-xl p-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                >
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer font-bold text-[11px] min-[768px]:text-xs tracking-wider bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    >
                      <div
                        className={cn("p-1.5 rounded-md", item.bg, item.color)}
                      >
                        <item.icon className="w-3.5 h-3.5 min-[768px]:w-4 min-[768px]:h-4" />
                      </div>
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => router.push("/admin")}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer font-bold text-[11px] min-[768px]:text-xs tracking-wider bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    >
                      <div className="p-1.5 rounded-md bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                        <UserCog className="w-3.5 h-3.5 min-[768px]:w-4 min-[768px]:h-4" />
                      </div>
                      {t("adminPanel")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="p-0">
                    <SignOutButton>
                      <button className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] tracking-wider">
                        <div className="p-1.5 rounded-md bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
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
            <div className="sticky top-[100px] h-fit z-20 space-y-6">
              <div className="flex flex-col gap-3">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "flex items-center justify-between p-3 min-[1084px]:p-3.5 min-[1503px]:p-4 rounded-xl transition-all group shadow-sm border",
                      activeTab === item.id
                        ? "bg-emerald-500 border-emerald-500 text-white scale-[1.02] shadow-md"
                        : "bg-white border-zinc-100 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700",
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

      {/* Тирезаҳои тасдиқ (Dialogs/Modals) */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6 gap-5 border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold tracking-tight leading-snug">
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-[13px] leading-relaxed">
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button
              type="button"
              className={cn(
                "flex-1 h-12 rounded-xl font-bold tracking-widest text-[10px]",
                confirmDialog.variant === "destructive"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white",
              )}
              onClick={() => confirmDialog.onConfirm()}
              disabled={confirmDialog.isLoading}
            >
              {confirmDialog.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : confirmDialog.variant === "destructive" ? (
                t("delete")
              ) : (
                t("confirm")
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold tracking-widest text-[10px] border-zinc-200"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модалкаи ҳатмии рақами телефон ва амният ҳангоми насби QR */}
      <Dialog
        open={showSecondaryPhoneModal}
        onOpenChange={setShowSecondaryPhoneModal}
      >
        <DialogContent className="sm:max-w-md rounded-3xl p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[100] max-h-[98vh] overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 px-8 pt-8 pb-4 space-y-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-1">
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
                    <div className="relative">
                      <Input
                        name="phone"
                        placeholder="XXXXXXXXX"
                        className="h-12 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 font-bold text-lg tracking-wider border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none"
                        required
                        inputMode="numeric"
                        onChange={(e) =>
                          (e.target.value = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          ))
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Рақами дуюм (агар набошад) */}
                {(!profile?.secondary_phone ||
                  !profile?.secondary_phone_type) && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.label")}
                      </Label>
                      <div className="relative">
                        <Input
                          name="secondary_phone"
                          placeholder={t("qrSecondaryModal.placeholder")}
                          className="h-12 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 font-bold text-lg tracking-wider text-emerald-600 dark:text-emerald-400 border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none"
                          required
                          inputMode="numeric"
                          onChange={(e) =>
                            (e.target.value = e.target.value.replace(
                              /[^0-9]/g,
                              "",
                            ))
                          }
                        />
                      </div>
                      <p className="text-[8px] font-bold text-zinc-400 px-1 leading-tight tracking-wider">
                        {t("phoneSecondaryDescription") ||
                          "Дар ҳолати гум шудани телефони шумо, ёбанда ба ин рақам занг мезанад."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[9px] font-bold text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.ownerQuestion")}
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "father",
                          "mother",
                          "brother",
                          "sister",
                          "spouse",
                        ].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setSecondaryType(type)}
                            className={cn(
                              "flex items-center justify-center py-3 rounded-xl transition-all duration-300 font-bold text-[10px] tracking-wider",
                              secondaryType === type
                                ? "bg-emerald-500 text-white shadow-md scale-[1.02]"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200",
                            )}
                          >
                            {t(`phoneSecondaryTypes.${type}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

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
                ((!profile?.secondary_phone ||
                  !profile?.secondary_phone_type) &&
                  !secondaryType) ||
                (profile?.accepted_terms !== true && !acceptedTerms)
              }
            >
              {secondaryLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                t("saveAndDownload") || "Захира ва боргирӣ"
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
      {/* Why QR Modal */}
      <Dialog open={showWhyQRModal} onOpenChange={setShowWhyQRModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-2">
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

                <div className="space-y-5 mt-4 bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
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
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
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
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
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

      {/* Security Mode Modal */}
      <Dialog open={showSecurityModal} onOpenChange={setShowSecurityModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("qrSecurityTitle") || "Реҷаи амниятӣ"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-zinc-500 dark:text-zinc-400 font-medium text-sm leading-relaxed space-y-4 text-left mt-4">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl">
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    {t("qrSecurityLong")}
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8">
            <Button
              onClick={() => setShowSecurityModal(false)}
              className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
            >
              {t("ok") || "Фаҳмо"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Modal */}
      <Dialog
        open={showDeleteAccountModal}
        onOpenChange={(open) =>
          !deletingAccount && setShowDeleteAccountModal(open)
        }
      >
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {t("deleteAccountConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
              {t("deleteAccountConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="w-full h-12 rounded-xl font-bold tracking-widest text-[11px] bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              {deletingAccount ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("deleteAccount")
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={deletingAccount}
              onClick={() => setShowDeleteAccountModal(false)}
              className="w-full h-11 rounded-xl font-bold tracking-widest text-[10px] text-zinc-500"
            >
              {t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-2">
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
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-2.5">
            <div className="text-center space-y-0.5 mb-2">
              <p className="font-bold text-[11px] text-zinc-900 dark:text-white">
                {t("clerk.signInTitle")}
              </p>
              <p className="text-[8px] font-bold text-zinc-400">
                {t("clerk.signInSubtitle")}
              </p>
            </div>
            <div className="h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="text-[8px] font-bold text-zinc-300">{t("clerk.dividerText")}</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-bold text-zinc-400 ml-1">{t("clerk.emailLabel")}</span>
              <div className="h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <span className="text-[8px] font-bold text-zinc-400">{t("clerk.signInPasswordLabel")}</span>
                <span className="relative text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md ring-2 ring-emerald-400">
                  {t("clerk.forgotPasswordLabel")}
                  <MousePointerClick className="w-3.5 h-3.5 absolute -bottom-3.5 -right-2.5 text-emerald-500 rotate-[-8deg]" />
                </span>
              </div>
              <div className="h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
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
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-2">
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
