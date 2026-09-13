/**
 * Ин саҳифа барои илова кардани эълони нав ҳаст (Add Item Page).
 * Дар ин ҷо мо формаро ба чанд қадам (steps) ҷудо кардем, то ки истифодааш осон ва зебо бошад.
 */ "use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { CATEGORIES, UNSPECIFIED_REWARD } from "@/lib/services/item-service";
import { ProfileService } from "@/lib/services/profile-service";
import {
  createClerkSupabaseClient,
  supabase as anonSupabase,
} from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
import { TelegramIcon, WhatsappIcon } from "@/components/social-icons";
import type { PrivacyRegion } from "@/components/privacy-blur-editor";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  X,
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { cn, stripDocumentNumbers } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ITEM_KEYS } from "@/lib/hooks/use-items";
import {
  JUST_PUBLISHED_EVENT,
  JUST_PUBLISHED_KEY,
  type JustPublishedState,
} from "@/lib/ui-constants";

// Ин ду компонент (муҳаррири canvas-и privacy blur, модали камера) вазнин
// ва танҳо дар ҳолатҳои хос (ҳуҷҷат ошкор шуд / камера кушода шуд) лозиманд
// — next/dynamic онҳоро аз chunk-и асосии саҳифаи "Илова кардани эълон"
// ҷудо мекунад.
const PrivacyBlurEditor = dynamic(() =>
  import("@/components/privacy-blur-editor").then((m) => m.PrivacyBlurEditor),
);
const CameraCaptureModal = dynamic(() =>
  import("@/components/camera-capture-modal").then((m) => m.CameraCaptureModal),
);

function AddItemForm() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const { status: pushStatus, subscribe: subscribeToPush } = useWebPush();

  // Refs for inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);

  // Ҳолатҳои форма (Form States)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [contactTelegram, setContactTelegram] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState(false);

  // Маълумоти эълон (Consolidated State for better stability)
  const [formData, setFormData] = useState({
    type: null as "lost" | "found" | null,
    title: "",
    category: "",
    description: "",
    phone: "",
    reward: "",
    locationType: null as "taxi" | "hotel_restaurant" | "public_place" | "airport" | null,
  });
  // Қадами 6 ("дар куҷо?") аз рӯи интихоб маҷбурист — вале "Дигар" низ як
  // интихоби эътиборнок аст (locationType ҳамоно null мемонад). Ин flag
  // танҳо барои фарқ кардани "ҳанӯз интихоб накардааст" аз "Дигарро
  // интихоб кард" лозим аст, то RadioGroup аз аввал холӣ намояд.
  const [locationAnswered, setLocationAnswered] = useState(false);

  // Танҳо барои formData.type === "found": корбар ашёро худаш нигоҳ
  // медорад, ё ба ҷои наздик (мағоза, дӯкон) месупорад.
  const [foundHandoff, setFoundHandoff] = useState<"self" | "nearby" | null>(null);
  const [handoffPhoto, setHandoffPhoto] = useState<File | null>(null);
  const [handoffPreview, setHandoffPreview] = useState<string | null>(null);

  // Тартиби воқеии қадамҳо аз рӯи навигатсия — қадами 3 (санҷиши AI)
  // охирин аст, на сеюм; қадами 6 ("дар куҷо?") пас аз тафсилот ҷойгир аст.
  // Қадами 7 (нигоҳ доштан ё супоридан) танҳо барои "found" илова мешавад.
  const stepOrder =
    formData.type === "found" ? [1, 2, 6, 4, 7, 5, 3] : [1, 2, 6, 4, 5, 3];
  const stepIndex = stepOrder.indexOf(step);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Муҳаррири ҳимояи махфият — на даъвати AI-и алоҳида, балки ҳамон
  // натиҷаи final_check-и аллакай-иҷрошуда (is_document + privacy_regions)
  // истифода мешавад. Агар ҳуҷҷат бошад, пас аз тасдиқи moderation, ин
  // тиреза барои ҳар акс паси ҳам кушода мешавад — бо минтақаҳои
  // пешниҳодкардаи AI, ки корбар метавонад бо қалам иваз/илова кунад.
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    regions: PrivacyRegion[];
    resolve: (result: File[] | null) => void;
  } | null>(null);

  // Огоҳии бехатарӣ БАЪД аз блур (агар ҳуҷҷат бошад), вале ПЕШ аз худи
  // нашри воқеӣ нишон дода мешавад — нашр танҳо пас аз "Фаҳмидам" оғоз мешавад.
  const [safetyAck, setSafetyAck] = useState<{ resolve: (proceed: boolean) => void } | null>(null);
  const [postSuccessRedirect, setPostSuccessRedirect] = useState("/profile?tab=posts");
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<
    "idle" | "checking" | "passed" | "failed"
  >("idle");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationViolationSource, setModerationViolationSource] = useState<
    "image" | "text" | "both" | null
  >(null);

  const [scanMessage, setScanMessage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Пешфарз true (то боркунии танзимот) — агар admin AI moderation-ро аз
  // dashboard хомӯш карда бошад (масалан токени OpenAI тамом шуда бошад),
  // эълонҳо бе санҷиши AI, бо moderation_status='pending' нашр мешаванд.
  const [aiModerationEnabled, setAiModerationEnabled] = useState(true);

  useEffect(() => {
    anonSupabase
      .from("app_settings")
      .select("ai_moderation_enabled")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        if (data) setAiModerationEnabled(data.ai_moderation_enabled);
      });
  }, []);

  useEffect(() => {
    if (moderationStatus !== "checking") {
      setElapsedSeconds(0);
      setActiveImageIndex(0);
      setScanMessage("");
      return;
    }

    const technicalSteps = [
      t("ai_steps.scanning_pixels"),
      t("ai_steps.detecting_features"),
      t("ai_steps.checking_safety"),
      t("ai_steps.matching_categories"),
      t("ai_steps.optimizing_description"),
      t("ai_steps.forensic_engine"),
    ];

    setScanMessage(t("ai_steps.brain_started"));
    let stepCount = 0;

    const interval = setInterval(() => {
      stepCount++;
      if (stepCount % 6 === 3) {
        setScanMessage(t("ai_steps.please_wait"));
      } else if (stepCount % 6 === 0) {
        setScanMessage(t("ai_steps.do_not_exit"));
      } else {
        setScanMessage(
          technicalSteps[Math.floor(stepCount / 2) % technicalSteps.length],
        );
      }
    }, 3000);

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => Math.min(prev + 1, 120));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [moderationStatus, t]);

  // Боргузории рақами телефон аз профил
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      try {
        const supabase = createClerkSupabaseClient(getToken);
        const profile = await ProfileService.getProfile(supabase, userId);
        if (profile?.phone) {
          setFormData((prev) => ({ ...prev, phone: profile.phone as string }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [userId, getToken]);


  const addNewFiles = (files: File[]) => {
    if (images.length + files.length > 4) {
      toast.error(t("maxImagesReached"));
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);

    // Reset AI state when images change
    setModerationStatus("idle");
  };

  // Танҳо ЯК акс барои ҷои супоридан — натиҷаи навро ҷойгузин мекунад.
  const setHandoffFile = (file: File | null) => {
    if (handoffPreview) URL.revokeObjectURL(handoffPreview);
    setHandoffPhoto(file);
    setHandoffPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addNewFiles(Array.from(e.target.files || []));
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      // Cleanup URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });

    // Reset AI state when images are removed
    setModerationStatus("idle");
  };

  // Санҷиши қадамҳо пеш аз гузаштан
  const nextStep = () => {
    if (step === 1) {
      if (images.length === 0) {
        toast.error(t("pickImage"));
        return;
      }
      setStep(2); // Ба қадами интихоби намуд мегузарем
    } else if (step === 2) {
      if (!formData.type) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(6); // "Дар куҷо?" фавран пас аз навъ — ҳамон савол давом мекунад
    } else if (step === 4) {
      if (
        !formData.title.trim() ||
        !formData.category ||
        !formData.description.trim()
      ) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(formData.type === "found" ? 7 : 5); // Тафсилот → нигоҳ/супоридан (агар found) → тамос
    } else if (step === 6) {
      if (!locationAnswered) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(4); // Ҷой → тафсилот
    } else if (step === 7) {
      if (!foundHandoff) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(5);
    } else if (step === 5) {
      if (!formData.phone.trim()) {
        toast.error(t("fillAllFields"));
        return;
      }
      onFinalSubmit();
    }
  };

  const prevStep = () => {
    if (step === 4) {
      setStep(6);
      setModerationStatus("idle");
    } else if (step === 6) {
      setStep(2);
    } else if (step === 7) {
      setStep(4);
    } else if (step === 5) {
      setStep(formData.type === "found" ? 7 : 4);
    } else if (step > 1 && step !== 3) {
      setStep(step - 1);
      // Reset moderation if going back to edit photos or type
      setModerationStatus("idle");
    }
  };

  const onFinalSubmit = async () => {
    setLoading(true);
    let finalImages: File[] = images;
    let finalTitle = formData.title;
    let finalDescription = formData.description;
    let finalCategory = formData.category;
    let finalModerationStatus: "approved" | "pending" = "approved";
    let finalModerationResult: string | null = "Approved by AI Brain";

    // Пурсиши иҷозати огоҳиномаро ҳамин ҷо оғоз мекунем (на баъд аз upload/insert) —
    // то браузер онро ҳамчун идомаи бевоситаи клики корбар шиносад (баъзе браузерҳо
    // permission prompt-ро пас аз чанд await рад мекунанд). Fire-and-forget аст,
    // нашри эълонро интизор намемонад. Пеш аз prompt як izoh-и кӯтоҳ нишон медиҳем,
    // то корбар фаҳмад ин пурсиш барои чист (ин ягона ҷои "хомӯш" буд, ки дар боз
    // кардани notification permission ягон изоҳ надошт).
    if (pushStatus === "default") {
      toast.info(t("pushPromptOnPublish"));
      subscribeToPush().catch(() => {});
    }

    setStep(3);

    if (aiModerationEnabled) {
      // 1. САНҶИШИ ЯГОНАИ БЕХАТАРӢ — акс (ниҳоӣ) + матн (ниҳоӣ) якҷоя, як бор,
      // дар ҳамин ҷо, пеш аз нашр. Ин ягона нуқтаи AI moderation дар тамоми
      // раванди илова кардани эълон аст (mode=suggest дар қадами 3 ҳеҷ гоҳ
      // рад намекунад — танҳо тавсиф медиҳад).
      setModerationStatus("checking");
      setScanMessage(
        t("ai_steps.checking_custom_text") || "AI эълони шуморо месанҷад...",
      );

      try {
        const finalCheckData = new FormData();
        const compressedForCheck = await Promise.all(
          images.map((img) => compressImage(img, 1024, 0.7)),
        );
        compressedForCheck.forEach((img) => finalCheckData.append("image", img));
        finalCheckData.append("title", formData.title);
        finalCheckData.append("description", formData.description);
        finalCheckData.append("lang", locale);
        finalCheckData.append("type", formData.type || "lost");
        finalCheckData.append("mode", "final_check");

        // ai-brain акнун тавассути route-и худи сервер (na бевосита аз
        // браузер ба Supabase) даъват мешавад — ниг. app/api/items/moderate.
        const checkRes = await fetch("/api/items/moderate", {
          method: "POST",
          body: finalCheckData,
        });
        const checkData = await checkRes.json().catch(() => null);
        const checkError = !checkRes.ok
          ? new Error(checkData?.error || "Санҷиши AI ноком шуд")
          : null;

        if (checkError || (checkData && checkData.is_safe === false)) {
          setModerationStatus("failed");
          setModerationError(
            checkData?.reason ||
              checkError?.message ||
              t("ai_steps.text_moderation_failed") ||
              "Эълони шумо ба қоидаҳо мувофиқат намекунад.",
          );
          setModerationViolationSource(checkData?.violation_source ?? null);
          setLoading(false);
          return;
        }

        // 1.4 ТОЗАКУНИИ МАТН — ваъдаи placeholder-и "AI онро дуруст мекунад".
        // Корбар метавонад шитобон ва бо хатоҳо нависад; AI онро ба тавсифи
        // хонданбоб табдил медиҳад ва унвонро ба як калима кӯтоҳ мекунад.
        //
        // Ин занги АЛОҲИДА нест — ҳамон санҷиши final_check-и боло ҳарду
        // натиҷаро якҷоя бармегардонад (мисли privacy_regions), пас ягон
        // таъхири нав ба вуҷуд намеояд.
        finalTitle = checkData?.polished_title || formData.title;
        finalDescription = checkData?.polished_description || formData.description;

        // 1.5 Ин натиҷаи ҳамин санҷиши боло аст (is_document + privacy_regions)
        // — на даъвати AI-и нав. Агар ҳуҷҷат бошад, пеш аз боркунӣ корбар
        // минтақаҳои пешниҳодкардаи AI-ро мебинад ва метавонад бо қалам
        // иваз/илова кунад пеш аз тасдиқ. Экрани "муваффақият" танҳо БАЪД аз
        // тамом шудани ҳамаи блурҳо нишон дода мешавад — на пеш аз он.
        if (checkData?.is_document) {
          // Рақами ҳуҷҷат/шиноснома аз матн нест карда мешавад, ном/насаб
          // бетағйир мемонад. Prompt аз AI талаб мекунад, ки polished_* низ
          // аллакай бе рақам бошад — `stripDocumentNumbers` танҳо панҷараи
          // эҳтиётист, агар модел онро сар диҳад. Ин ҷо хато қиммати баланд
          // дорад: рақами шиносномаи як одами воқеӣ ошкор мешавад.
          finalTitle = stripDocumentNumbers(finalTitle);
          finalDescription = stripDocumentNumbers(finalDescription);
          // Категория маҷбуран "Ҳуҷҷатҳо" мешавад, новобаста аз он ки корбар
          // кадом категорияро интихоб карда буд.
          finalCategory = "Documents";

          setModerationStatus("idle");
          const suggestedRegions: PrivacyRegion[] = checkData.privacy_regions ?? [];
          const blurred = await new Promise<File[] | null>((resolve) => {
            setPrivacyReview({ files: images, regions: suggestedRegions, resolve });
          });
          if (!blurred) {
            // Корбар аз тирезаи блур баромад — нашрро бас мекунем, то
            // ҳуҷҷати бе мозаика ҳаргиз нашр нашавад.
            setStep(4);
            setLoading(false);
            return;
          }
          setImages(blurred);
          finalImages = blurred;
        }
      } catch (err) {
        setModerationStatus("failed");
        setModerationError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        return;
      }
    } else {
      // AI moderation аз admin dashboard хомӯш карда шудааст (масалан
      // токени OpenAI тамом шудааст) — бе санҷиш, эълон бо ҳолати "дар
      // интизор" нашр мешавад: танҳо дар профили худи корбар намоён аст
      // (search_items RPC чунин филтр мекунад), то admin дастӣ тафтиш кунад.
      finalModerationStatus = "pending";
      // ДИҚҚАТ: moderation_result ба корбар дар саҳифаи эълон намоён аст
      // (ниг. item-details-client.tsx). Бинобар ин инҷо ҳеҷ сабабе навишта
      // намешавад — корбар набояд бидонад, ки AI хомӯш аст; барои ӯ ин
      // ҳамон ҳолати муқаррарии "дар ҳоли санҷиш" аст.
      finalModerationResult = null;
    }

    // 1.6 Пеш аз худи нашр маслиҳати бехатариро нишон медиҳем — нашр
    // танҳо пас аз "Фаҳмидам" оғоз мешавад.
    setModerationStatus("idle");
    const proceed = await new Promise<boolean>((resolve) => {
      setSafetyAck({ resolve });
    });
    if (!proceed) {
      setStep(4);
      setLoading(false);
      return;
    }

    // 2. НАШРИ ЭЪЛОН — санҷиши AI ва тасдиқҳои корбар аллакай тамом
    // шуданд. Фавран экрани муваффақиятро нишон медиҳем — боркунии аксҳо
    // ва сабти воқеӣ дар база дар паси парда идома меёбанд, то корбар
    // мунтазир намонад. Агар дар паси парда хатогӣ рӯй диҳад, огоҳии toast
    // мебарояд (экран ба ҳолати "ноком" бознамегардад, зеро корбар аллакай
    // "муваффақият"-ро дидааст).
    setPostSuccessRedirect("/profile?tab=posts");
    setModerationStatus("passed");

    // "Тамом" интизор намешавад — корбар метавонад аллакай дар саҳифаи
    // профил бошад, вақте ки сабт тамом мешавад. Пас ҳам event (агар
    // рӯйхат кушода бошад), ҳам sessionStorage (агар баъдтар кушода
    // шавад) лозим аст.
    //
    // `startedAt` ҲОЗИР гирифта мешавад, на баъд аз сабт: боркунии аксҳо
    // 3-5 сония мегирад ва бе ин ҳисобкунак дар корт аз нав аз 10 сар
    // мешуд, дар ҳоле ки санҷиш аллакай оғоз шудааст.
    const startedAt = Date.now();
    const announce = (id?: string) => {
      const state: JustPublishedState = { id, startedAt };
      try {
        sessionStorage.setItem(JUST_PUBLISHED_KEY, JSON.stringify(state));
      } catch {
        // Safari-и private mode — event худаш кифоя аст.
      }
      window.dispatchEvent(
        new CustomEvent(JUST_PUBLISHED_EVENT, { detail: state }),
      );
    };

    // Фавран, пеш аз боркунӣ — то ҳисобкунак аз ҳамин лаҳза ҳисоб шавад.
    announce();

    const announcePublished = (id: string) => {
      announce(id);
      queryClient.invalidateQueries({ queryKey: ITEM_KEYS.user() });
      window.dispatchEvent(new Event("items-updated"));
    };

    const publishWork = async () => {
      const supabase = createClerkSupabaseClient(getToken);

      const imageUrls = [];
      for (const file of finalImages) {
        const compressedFile = await compressImage(file);
        const ext = compressedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("items")
          .upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("items").getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const isNearbyHandoff = formData.type === "found" && foundHandoff === "nearby";
      let handoffPhotoUrl: string | null = null;
      if (isNearbyHandoff && handoffPhoto) {
        const compressedHandoff = await compressImage(handoffPhoto);
        const ext = compressedHandoff.name.split(".").pop();
        const handoffFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: handoffUploadError } = await supabase.storage
          .from("items")
          .upload(handoffFileName, compressedHandoff);
        if (handoffUploadError) throw handoffUploadError;
        const {
          data: { publicUrl: handoffPublicUrl },
        } = supabase.storage.from("items").getPublicUrl(handoffFileName);
        handoffPhotoUrl = handoffPublicUrl;
      }

      const itemData = {
        user_id: userId,
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        type: formData.type,
        phone_number: formData.phone,
        contact_telegram: contactTelegram,
        contact_whatsapp: contactWhatsapp,
        handoff_type: formData.type === "found" ? foundHandoff : null,
        handoff_phone: isNearbyHandoff ? formData.phone : null,
        handoff_photo_url: handoffPhotoUrl,
        reward:
          formData.type === "lost"
            ? rewardEnabled
              ? UNSPECIFIED_REWARD
              : formData.reward || null
            : null,
        date: new Date().toISOString().split("T")[0],
        is_resolved: false,
        moderation_status: finalModerationStatus,
        moderation_result: finalModerationResult,
        location_type: formData.locationType,
      };

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert([itemData])
        .select()
        .single();
      if (itemError) throw itemError;

      // Эълони беакс — аксҳо интизор карда намешаванд.
      if (imageUrls.length === 0) announcePublished(item.id);

      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map((url) => ({
          item_id: item.id,
          image_url: url,
          embedding: null,
        }));

        const { error: imagesError } = await supabase
          .from("item_images")
          .insert(imageRecords);

        // Аз ҳамин лаҳза эълон бо аксаш дар рӯйхат намоён аст. Сохтани
        // вектор (поён) дар паси парда мемонад ва рӯйхатро нигоҳ намедорад.
        announcePublished(item.id);

        if (imagesError) {
          console.error("DATABASE ERROR:", imagesError.message);
        } else {
          // Vector-и visual-search бояд гум нашавад — на fire-and-forget.
          // Мунтазир мешавем ва як бор такрор мекунем, агар кӯшиши аввал
          // ноком шавад; агар боз ҳам ноком шавад, эълон аллакай нашр
          // шудааст (маводи АСОСӢ дар хатар нест), танҳо ҷустуҷӯи аксӣ
          // барои ин ашё кор намекунад — корбарро бо огоҳии мулоим хабар медиҳем.
          // МУҲИМ: вектор бояд аз АКС сохта шавад, на аз матни хом.
          //
          // visual-search дархостро ҳамчун "forensic description"-и англисӣ
          // аз акс месозад (ниг. supabase/functions/visual-search). Агар
          // вектори захирашуда аз `title + description`-и кӯтоҳи тоҷикӣ
          // сохта шавад, ду вектор дар фазоҳои тамоман гуногун меафтанд —
          // ашёи дуруст ҳаргиз ёфт намешавад, ба ҷои он ашёи тасодуфӣ
          // мебарояд.
          //
          // generate-embedding аксҳоро ХУДАШ аз item_images мегирад (ҳамаро,
          // на танҳо аввалинро), пас ин ҷо `image_url` фиристода намешавад.
          // `text` ба модели vision ҳамчун контекст дода мешавад, то ба
          // ҳамон тавсифи англисӣ ҳамроҳ гардад.
          let embeddingOk = false;
          for (let attempt = 0; attempt < 2 && !embeddingOk; attempt++) {
            const { error: embError } = await supabase.functions.invoke(
              "generate-embedding",
              {
                body: {
                  item_id: item.id,
                  text: `${itemData.title} ${itemData.description}`,
                },
              },
            );
            if (!embError) embeddingOk = true;
            else
              console.error(
                `Embedding attempt ${attempt + 1} failed:`,
                embError,
              );
          }
          if (!embeddingOk) {
            toast.warning(
              t("embeddingFailedWarning") ||
                "Эълон нашр шуд, вале ҷустуҷӯи аксӣ барои он ҳоло дастрас нест.",
            );
          }
        }
      }

      toast.success(t("imageModeration.submitted"));
      await queryClient.invalidateQueries({ queryKey: ITEM_KEYS.user() });
      window.dispatchEvent(new Event("items-updated"));
      fetch(
        `https://www.google.com/ping?sitemap=https://juyo.tj/sitemap.xml`,
      ).catch(() => {});
    };

    publishWork().catch((error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("error"));
    });
    setLoading(false);
  };

  // МИҚЁСИ КУНҶҲО — ҳамин панҷро истифода баред, қимати нав насозед.
  // Пештар дар ин саҳифа 9 радиуси гуногун буд, аз ҷумла `rounded-[1.5rem]`
  // ва `rounded-3xl`, ки АЙНАН як қиматанд (24px), ва ду dialog-и якхела бо
  // кунҷи гуногун. Маҳз ҳамин парокандагӣ ба чашм мезанад.
  //
  //   rounded-md    6px   checkbox ва нишонаҳои хеле хурд
  //   rounded-xl   12px   input, select, иконкаҳои 32–40px, тугмаи пӯшидан
  //   rounded-2xl  16px   тугмаҳо, кортҳо, иконкаҳои ~64px
  //   rounded-3xl  24px   dialog, панелҳои калон, иконкаҳои ~80px+
  //   rounded-full        pill ва доираҳо
  return (
    <div className="mx-auto w-full max-w-7xl px-0 sm:px-0 py-0 sm:py-0 h-[calc(100dvh-128px)] sm:h-[calc(100dvh-64px)] flex flex-col">
      <Card className="flex-1 rounded-none overflow-hidden border-none shadow-none flex flex-col bg-canvas">
        {/* Step Indicator */}
        {/* Тартиби воқеии қадамҳо аз рӯи навигатсия 1→2→3→4→5 НЕСТ — қадами
            3 (санҷиши AI) охирин аст, танҳо ҳангоми нашр (onFinalSubmit)
            нишон дода мешавад: 1 → 2 → 4 → 5 → 3. Муқоисаи рақамии оддии
            step > i+1 нодуруст буд — вақте ки step=3 мешуд, қадамҳои 4 ва 5
            (ки аллакай гузашта буданд) хато холӣ (khokistarranga) нишон
            дода мешуданд. */}
        <div className="w-full flex h-1.5 gap-1 bg-white dark:bg-zinc-800 overflow-hidden shrink-0">
          {stepOrder.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-full flex-1 transition-all duration-700 ease-in-out",
                stepIndex > i
                  ? "bg-emerald-500"
                  : stepIndex === i
                    ? "bg-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-700",
              )}
            />
          ))}
        </div>

        <CardContent className="p-2 sm:p-4 md:p-6 lg:p-8 flex-1 flex flex-col justify-start pt-10 sm:pt-6 overflow-y-auto scrollbar-none">
          {/* Step 1: Photos First (Refined) */}
          {step === 1 && (
            <div className="space-y-6 w-full pt-4">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("pickImage")}
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
                {images.length < 4 && (
                  <div
                    onClick={() => setShowPhotoChoice(true)}
                    className="aspect-square flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 transition-all group order-first"
                  >
                    <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 rounded-full bg-canvas dark:bg-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Plus className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6" strokeWidth={3} />
                    </div>
                  </div>
                )}
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl overflow-hidden group bg-white dark:bg-zinc-800"
                  >
                    <Image
                      src={src}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 min-[1084px]:p-2 rounded-xl transition-all z-20"
                    >
                      <X className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 min-[1920px]:w-4 min-[1920px]:h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Hidden Inputs */}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                ref={galleryInputRef}
                onChange={handleImageChange}
              />

              <Dialog open={showPhotoChoice} onOpenChange={setShowPhotoChoice}>
                <DialogContent className="max-w-[320px] rounded-3xl p-5 pt-11 border-none shadow-2xl gap-4 focus:ring-0 focus:outline-none">
                  <DialogHeader className="mb-2">
                    <DialogTitle className="text-lg min-[1084px]:text-xl min-[1920px]:text-2xl font-bold tracking-tight text-center text-emerald-600 dark:text-emerald-400">
                      {t("choose_photo_method")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-24 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        setShowCameraCapture(true);
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white transition-all">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold tracking-wide text-zinc-500">
                        {t("camera")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-24 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        galleryInputRef.current?.click();
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white transition-all">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold tracking-wide text-zinc-500">
                        {t("gallery")}
                      </span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <CameraCaptureModal
                isOpen={showCameraCapture}
                onClose={() => setShowCameraCapture(false)}
                onCapture={(file) => addNewFiles([file])}
              />
            </div>
          )}

          {/* Step 2: Type Selection */}
          {step === 2 && (
            <div className="space-y-6 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("what_happened")}
                </h2>
              </div>
              <RadioGroup
                value={formData.type || ""}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: val as "lost" | "found",
                  }))
                }
                className="grid grid-cols-1 gap-3"
              >
                <div className="relative">
                  <Label
                    htmlFor="lost"
                    className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-xl bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🔍
                    </div>
                    <div className="flex-1">
                      <span className="block font-bold text-base min-[1084px]:text-lg leading-snug text-red-600 dark:text-red-500">
                        {t("lost")}
                      </span>
                      <span className="text-zinc-400 text-[13px] min-[1084px]:text-sm font-medium">
                        {t("lost_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="lost"
                      id="lost"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-zinc-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-xl bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🎁
                    </div>
                    <div className="flex-1">
                      <span className="block font-bold text-base min-[1084px]:text-lg leading-snug text-emerald-600 dark:text-emerald-500">
                        {t("found")}
                      </span>
                      <span className="text-zinc-400 text-[13px] min-[1084px]:text-sm font-medium">
                        {t("found_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="found"
                      id="found"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-zinc-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 6: Ҷои гумшудан/ёфтшудан (ихтиёрӣ) */}
          {step === 6 && (
            <div className="space-y-6 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formData.type === "lost"
                    ? t("addItemLocationStep.titleLost")
                    : formData.type === "found"
                      ? t("addItemLocationStep.titleFound")
                      : t("addItemLocationStep.title")}
                </h2>
              </div>
              <RadioGroup
                value={locationAnswered ? formData.locationType || "none" : undefined}
                onValueChange={(val) => {
                  setLocationAnswered(true);
                  setFormData((prev) => ({
                    ...prev,
                    locationType:
                      val === "none"
                        ? null
                        : (val as "taxi" | "hotel_restaurant" | "public_place" | "airport"),
                  }));
                }}
                className="grid grid-cols-1 gap-3"
              >
                {(
                  [
                    { value: "taxi", emoji: "🚕" },
                    { value: "airport", emoji: "✈️" },
                    { value: "hotel_restaurant", emoji: "🏨" },
                    { value: "public_place", emoji: "🎭" },
                    { value: "none", emoji: "🤷" },
                  ] as const
                ).map((opt) => (
                  <div key={opt.value} className="relative">
                    <Label
                      htmlFor={`loc-${opt.value}`}
                      className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-xl bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                        {opt.emoji}
                      </div>
                      <span className="flex-1 font-bold text-base min-[1084px]:text-lg leading-snug">
                        {opt.value === "none"
                          ? t("addItemLocationStep.notSpecified")
                          : t(`addItemLocationStep.${opt.value}`)}
                      </span>
                      <RadioGroupItem
                        value={opt.value}
                        id={`loc-${opt.value}`}
                        className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-zinc-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                      />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 7: Нигоҳ медорӣ ё месупорӣ? — танҳо барои formData.type === "found" */}
          {step === 7 && (
            <div className="space-y-6 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("addHandoffStep.title")}
                </h2>
              </div>
              <RadioGroup
                value={foundHandoff || ""}
                onValueChange={(val) => setFoundHandoff(val as "self" | "nearby")}
                className="grid grid-cols-1 gap-3"
              >
                {(
                  [
                    { value: "self", emoji: "🤝" },
                    { value: "nearby", emoji: "🏪" },
                  ] as const
                ).map((opt) => (
                  <div key={opt.value} className="relative">
                    <Label
                      htmlFor={`handoff-${opt.value}`}
                      className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-xl bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                        {opt.emoji}
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-base min-[1084px]:text-lg leading-snug">
                          {t(`addHandoffStep.${opt.value}`)}
                        </span>
                        <span className="text-zinc-400 text-[13px] min-[1084px]:text-sm font-medium">
                          {t(`addHandoffStep.${opt.value}Desc`)}
                        </span>
                      </div>
                      <RadioGroupItem
                        value={opt.value}
                        id={`handoff-${opt.value}`}
                        className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-zinc-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                      />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 3: AI Scanning & Auto-fill (Inline Visual Search Style) */}
          {step === 3 && (
            <div className="space-y-6 text-center max-w-5xl mx-auto w-full py-2 flex-1 flex flex-col justify-start pt-4 sm:pt-6">
              {moderationStatus === "checking" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative group w-full aspect-square max-w-[85vw] sm:max-w-[40vh] lg:max-w-[30vh]">
                    {/* Soft Glow */}
                    <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>

                    {/* Image Container - Exact Visual Search Style */}
                    <div className="relative h-full w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
                      <div className="flex flex-col items-center h-full w-full">
                        <div className="relative w-full h-full overflow-hidden">
                          {previews[activeImageIndex] && (
                            <>
                              {/* Blurred background for empty spaces */}
                              <Image
                                src={previews[activeImageIndex]}
                                alt=""
                                fill
                                className="object-cover blur-3xl opacity-40 scale-110"
                              />
                              <Image
                                src={previews[activeImageIndex]}
                                alt="Analyzing"
                                fill
                                className="object-contain opacity-60 transition-all duration-1000 relative z-10"
                                key={activeImageIndex}
                              />
                            </>
                          )}

                          {/* Laser Scanner - Exact match to modal */}
                          <div className="absolute inset-0 z-20 pointer-events-none">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-scan-fast" />
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent h-1/2 animate-scan-overlay" />
                          </div>

                          {/* Neural Grid Overlay - Exact match to modal */}
                          <div
                            className="absolute inset-0 opacity-90 animate-grid-scan z-10 pointer-events-none"
                            style={{
                              backgroundImage:
                                "radial-gradient(rgba(52, 211, 153, 1) 1.5px, transparent 1.5px)",
                              backgroundSize: "25px 25px",
                            }}
                          />

                          {/* Timer & Counter Overlay */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm min-[1084px]:text-base min-[1920px]:text-lg font-bold text-white tracking-widest whitespace-nowrap">
                              {t("ai_steps.seconds_left").replace(
                                "%{count}",
                                elapsedSeconds.toString(),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Text & Info */}
                  <div className="space-y-4 w-full px-4 sm:px-6">
                    <div className="h-8 flex items-center justify-center">
                      <p
                        className="text-sm sm:text-base min-[1084px]:text-lg min-[1920px]:text-xl text-emerald-600 dark:text-emerald-400 font-bold tracking-[0.2em] text-center"
                        key={scanMessage}
                      >
                        {scanMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed State UI (White Theme) */}
              {moderationStatus === "failed" && (
                <div className="space-y-6 text-center max-w-md mx-auto p-6 bg-white dark:bg-zinc-800 rounded-3xl">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-3xl bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-red-500" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-xl min-[1503px]:text-2xl min-[1920px]:text-[26px] font-bold tracking-tight text-red-600 dark:text-red-400">
                      {t("ai_steps.step5_failed")}
                    </h2>
                    <div className="bg-canvas dark:bg-zinc-700 p-4 rounded-2xl">
                      <p className="text-red-700 font-bold text-sm leading-relaxed">
                        {moderationError || t("error")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Санҷиши ниҳоӣ акс+матнро якҷоя месанҷад — агар
                        // сабаби рад акс бошад, корбарро ба қадами акс (1)
                        // бармегардонем ва аксҳои радшударо тоза мекунем, то
                        // акси наверо интихоб кунад; агар танҳо матн бошад,
                        // ба қадами тавсиф (4) бармегардонем.
                        if (
                          moderationViolationSource === "image" ||
                          moderationViolationSource === "both"
                        ) {
                          setImages([]);
                          setPreviews((prev) => {
                            prev.forEach((url) => URL.revokeObjectURL(url));
                            return [];
                          });
                          setStep(1);
                        } else {
                          setStep(4);
                        }
                        setModerationStatus("idle");
                        setModerationViolationSource(null);
                      }}
                      className="rounded-xl font-bold text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-widest mt-4 text-red-600 dark:text-red-400 border-red-200 hover:bg-red-100"
                    >
                      {t("ai_steps.step5_fix_btn")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Passed State UI — то дар фосилаи байни қабули AI ва
                  нашри ниҳоӣ (боркунии аксҳо, сабти база) экран холӣ/сафед
                  нанамояд. */}
              {moderationStatus === "passed" && (
                <div className="space-y-6 max-w-sm mx-auto w-full">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-3xl bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {t("success")}
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm tracking-tight">
                      {t("imageModeration.submitted")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(postSuccessRedirect)}
                    className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-2xl font-bold tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {t("done")}
                  </Button>
                </div>
              )}

              {/* Idle — вақте ки корбар дар тирезаи блур аст (privacyReview
                  боз аст) ё AI натиҷаро аллакай пеш аз боркунии ниҳоӣ дод. */}
              {moderationStatus === "idle" && (
                <div className="space-y-4">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-3xl bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <Loader2 className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-emerald-500 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details (Auto-filled) */}
          {step === 4 && (
            <div className="space-y-5 max-w-lg mx-auto w-full">
              <div className="space-y-1.5">
                <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                  {t("titleLabel")}
                </Label>
                <Input
                  placeholder={t("titleLabel")}
                  // placeholder:font-medium — худи унвон ғафс мемонад, вале
                  // placeholder бо ҳамон вазни placeholder-и тавсиф, вагарна
                  // ғафсӣ онро серангтар нишон медиҳад.
                  className="rounded-xl h-11 min-[1084px]:h-12 bg-white dark:bg-zinc-800 border-none text-sm min-[1084px]:text-base font-bold placeholder:font-medium shadow-none"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                  {t("categoryLabel")}
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          category: cat.name,
                        }))
                      }
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 min-[1084px]:p-2.5 rounded-xl bg-white dark:bg-zinc-800 ring-2 ring-transparent transition-all text-center",
                        formData.category === cat.name
                          ? "ring-2 ring-emerald-500 bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400"
                          : "text-zinc-600",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 min-[1084px]:w-10 min-[1084px]:h-10 rounded-xl flex items-center justify-center text-base min-[1084px]:text-lg shrink-0",
                          formData.category === cat.name
                            ? "bg-canvas"
                            : "bg-canvas",
                        )}
                      >
                        {cat.icon}
                      </div>
                      <span className="text-[10px] min-[1084px]:text-[11px] font-bold tracking-tight leading-tight">
                        {t(`categories.${cat.id}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                  {t("description")}
                </Label>
                <Textarea
                  // Ваъдаи ин placeholder воқеӣ аст: вақте AI фаъол бошад,
                  // final_check матнро тоза мекунад (polished_description).
                  // Вақте хомӯш бошад, ҳеҷ кас онро дуруст намекунад — пас
                  // аз корбар матни пурраро мепурсем.
                  placeholder={
                    aiModerationEnabled
                      ? t("descPlaceholderAi")
                      : t("descPlaceholderManual")
                  }
                  className="rounded-xl min-h-[88px] min-[1084px]:min-h-[104px] bg-white dark:bg-zinc-800 border-none text-sm min-[1084px]:text-base font-medium shadow-none resize-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Step 5: Contact & Reward */}
          {step === 5 && (
            <div className="space-y-6 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formData.type === "found" && foundHandoff === "nearby"
                    ? t("addHandoffStep.phoneStepTitle")
                    : t("contactInfo") || "Contact Information"}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                    {formData.type === "found" && foundHandoff === "nearby"
                      ? t("addHandoffStep.phoneLabel")
                      : t("phoneLabel")}
                  </Label>
                  <PhoneInput
                    placeholder={
                      formData.type === "found" && foundHandoff === "nearby"
                        ? t("addHandoffStep.phonePlaceholder")
                        : undefined
                    }
                    containerClassName="h-13 min-[1084px]:h-14 bg-white dark:bg-zinc-800"
                    className="text-base min-[1084px]:text-lg text-emerald-600 dark:text-emerald-400"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                {formData.type === "found" && foundHandoff === "nearby" && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                      {t("addHandoffStep.photoLabel")}
                    </Label>
                    {handoffPreview ? (
                      <div className="relative w-28 h-28 rounded-xl overflow-hidden group bg-white dark:bg-zinc-800">
                        <Image
                          src={handoffPreview}
                          alt="Handoff preview"
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setHandoffFile(null)}
                          className="absolute top-1.5 right-1.5 bg-white/90 dark:bg-black/90 text-red-500 p-1 rounded-lg z-20"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-28 h-28 flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 transition-all group">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => setHandoffFile(e.target.files?.[0] || null)}
                        />
                        <div className="w-10 h-10 rounded-full bg-canvas dark:bg-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <Plus className="w-5 h-5" strokeWidth={3} />
                        </div>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-xl bg-white dark:bg-zinc-800 px-4 py-3">
                    <Checkbox
                      checked={contactTelegram}
                      className="w-5 h-5 rounded-md border-zinc-200 dark:border-zinc-600 shrink-0"
                      onCheckedChange={(checked) => setContactTelegram(checked === true)}
                    />
                    <TelegramIcon size={20} />
                    <span className="text-xs min-[1084px]:text-sm font-bold text-zinc-500">
                      {t("contactViaTelegram")}
                    </span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-xl bg-white dark:bg-zinc-800 px-4 py-3">
                    <Checkbox
                      checked={contactWhatsapp}
                      className="w-5 h-5 rounded-md border-zinc-200 dark:border-zinc-600 shrink-0"
                      onCheckedChange={(checked) => setContactWhatsapp(checked === true)}
                    />
                    <WhatsappIcon size={20} />
                    <span className="text-xs min-[1084px]:text-sm font-bold text-zinc-500">
                      {t("contactViaWhatsapp")}
                    </span>
                  </label>
                </div>
                {formData.type === "lost" && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl bg-white dark:bg-zinc-800 px-4 py-3">
                      <Checkbox
                        checked={rewardEnabled}
                        className="w-5 h-5 rounded-md border-zinc-200 dark:border-zinc-600 shrink-0"
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setRewardEnabled(isChecked);
                          if (isChecked) {
                            setFormData((prev) => ({ ...prev, reward: "" }));
                          }
                        }}
                      />
                      <span className="text-sm min-[1084px]:text-base font-bold text-zinc-500">
                        {t("reward_gives")}
                      </span>
                    </label>
                    {!rewardEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] min-[1084px]:text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                          {t("reward_gives_input")}
                        </Label>
                        <div className="relative">
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-sm min-[1084px]:text-base text-zinc-400">
                            TJS
                          </span>
                          <Input
                            placeholder={t("reward_gives_input")}
                            className="rounded-xl h-13 min-[1084px]:h-14 bg-white dark:bg-zinc-800 border-none shadow-none text-base min-[1084px]:text-lg font-bold text-emerald-600 dark:text-emerald-400 pr-14 pl-5 transition-all"
                            value={formData.reward}
                            onChange={(e) => {
                              const digits = e.target.value
                                .replace(/[^0-9]/g, "")
                                .replace(/^0+/, "")
                                .slice(0, 4);
                              setFormData((prev) => ({
                                ...prev,
                                reward: digits,
                              }));
                            }}
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </CardContent>

        {/* Navigation Footer */}
        <div className="px-2.5 pt-3 pb-0 sm:px-10 sm:pt-8 sm:pb-2 bg-canvas shrink-0">
          <div className="flex gap-3 sm:gap-4 items-center w-full">
            {step > 1 && step !== 3 && (
              <Button
                variant="outline"
                size="lg"
                onClick={prevStep}
                className="flex-1 rounded-2xl h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] border-none shadow-none bg-white dark:bg-zinc-800 font-medium tracking-normal text-sm min-[1084px]:text-base text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
              >
                <ArrowLeft className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5 mr-2" />
                {t("back")}
              </Button>
            )}
            {(step === 1 || step === 2 || step === 6 || step === 4 || step === 7) && (
              <Button
                size="lg"
                onClick={nextStep}
                className="flex-1 rounded-2xl h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] font-bold tracking-widest text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] bg-emerald-500 hover:bg-emerald-600 text-white transition-all"
              >
                {t("next")}
              </Button>
            )}
            {step === 5 && (
              <Button
                onClick={nextStep}
                disabled={loading}
                className="flex-1 rounded-2xl h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-widest text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 animate-spin" />
                ) : (
                  t("publishBtn")
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Safety Advice Modal — баъд аз блур (агар ҳуҷҷат бошад), пеш аз худи нашр */}
      <Dialog
        open={!!safetyAck}
        onOpenChange={(v) => {
          if (!v && safetyAck) {
            const resolve = safetyAck.resolve;
            setSafetyAck(null);
            resolve(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-7 space-y-5 text-center">
            <div className="w-16 h-16 min-[1084px]:w-20 min-[1084px]:h-20 min-[1920px]:w-24 min-[1920px]:h-24 rounded-2xl flex items-center justify-center mx-auto bg-red-50 dark:bg-red-900/20">
              <ShieldAlert className="w-8 h-8 min-[1084px]:w-10 min-[1084px]:h-10 min-[1920px]:w-11 min-[1920px]:h-11 text-red-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg min-[1084px]:text-xl min-[1920px]:text-2xl font-bold tracking-tight leading-snug">
                {formData.type === "found"
                  ? t("safetyPostModal.foundTitle")
                  : t("safetyPostModal.lostTitle")}
              </DialogTitle>
              <p className="text-zinc-500 font-bold text-[13px] min-[1084px]:text-sm min-[1920px]:text-base leading-relaxed">
                {formData.type === "found"
                  ? t("safetyPostModal.foundDesc")
                  : t("safetyPostModal.lostDesc")}
              </p>
            </div>
          </div>
          <div className="px-7 pb-7">
            <Button
              onClick={() => {
                const resolve = safetyAck?.resolve;
                setSafetyAck(null);
                resolve?.(true);
              }}
              className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-2xl font-bold tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] text-white bg-emerald-500 hover:bg-emerald-600"
            >
              {t("safetyPostModal.confirmBtn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {privacyReview && (
        <PrivacyBlurEditor
          open
          files={privacyReview.files}
          initialRegions={privacyReview.regions}
          onConfirm={(finalFiles) => {
            const resolve = privacyReview.resolve;
            setPrivacyReview(null);
            resolve(finalFiles);
          }}
          onCancel={() => {
            const resolve = privacyReview.resolve;
            setPrivacyReview(null);
            resolve(null);
          }}
        />
      )}

      <style jsx global>{`
        @keyframes scan-fast {
          0% {
            top: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes scan-overlay {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(200%);
          }
        }
        @keyframes grid-scan {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 25px 25px;
          }
        }
        .animate-scan-fast {
          animation: scan-fast 1.5s linear infinite !important;
        }
        .animate-scan-overlay {
          animation: scan-overlay 2.5s ease-in-out infinite !important;
        }
        .animate-grid-scan {
          animation: grid-scan 1.5s linear infinite !important;
        }
      `}</style>
    </div>
  );
}

export default function AddItemPage() {
  return (
    <TooltipProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-10 h-10 animate-spin" />
          </div>
        }
      >
        <AddItemForm />
      </Suspense>
    </TooltipProvider>
  );
}
