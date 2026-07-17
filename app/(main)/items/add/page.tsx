/**
 * Ин саҳифа барои илова кардани эълони нав ҳаст (Add Item Page).
 * Дар ин ҷо мо формаро ба чанд қадам (steps) ҷудо кардем, то ки истифодааш осон ва зебо бошад.
 */ "use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { ItemService, CATEGORIES } from "@/lib/services/item-service";
import { ProfileService } from "@/lib/services/profile-service";
import {
  createClerkSupabaseClient,
  supabase as anonSupabase,
} from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
import { PrivacyBlurEditor, type PrivacyRegion } from "@/components/privacy-blur-editor";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  X,
  Upload,
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  Search,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ITEM_KEYS } from "@/lib/hooks/use-items";
import { CameraCaptureModal } from "@/components/camera-capture-modal";

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

  // Маълумоти эълон (Consolidated State for better stability)
  const [formData, setFormData] = useState({
    type: null as "lost" | "found" | null,
    title: "",
    category: "",
    description: "",
    phone: "",
    reward: "",
  });

  // Тартиби воқеии қадамҳо аз рӯи навигатсия — қадами 3 (санҷиши AI)
  // охирин аст, на сеюм (ниг. nextStep/onFinalSubmit поён).
  const stepOrder = [1, 2, 4, 5, 3];
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
  const [showSearchChoice, setShowSearchChoice] = useState(false);
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
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
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
    if (images.length + files.length > 5) {
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
      // Ҳеҷ AI дар ин ҷо кор намекунад — корбар худаш маълумотро пур мекунад.
      // AI ягона бор, дар охир (onFinalSubmit), акс+матни ниҳоиро месанҷад.
      setStep(4);
    } else if (step === 4) {
      if (
        !formData.title.trim() ||
        !formData.category ||
        !formData.description.trim()
      ) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(5); // Move to Step 5 (Phone & Reward)
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
      setStep(2); // Skip Step 3 (Scan) and go to Type Selection
      setModerationStatus("idle");
    } else if (step === 5) {
      setStep(4);
    } else if (step > 1 && step !== 3) {
      setStep(step - 1);
      // Reset moderation if going back to edit photos or type
      setModerationStatus("idle");
    }
  };

  const onFinalSubmit = async () => {
    let finalImages: File[] = images;
    let finalTitle = formData.title;
    let finalDescription = formData.description;
    let finalCategory = formData.category;
    let finalModerationStatus: "approved" | "pending" = "approved";
    let finalModerationResult = "Approved by AI Brain";

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
        let supabaseClient;
        if (userId) {
          const token = await getToken({ template: "supabase" });
          supabaseClient = createClerkSupabaseClient(token!);
        } else {
          supabaseClient = anonSupabase;
        }

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

        const { data: checkData, error: checkError } =
          await supabaseClient.functions.invoke("ai-brain", {
            body: finalCheckData,
          });

        if (checkError || (checkData && checkData.is_safe === false)) {
          setModerationStatus("failed");
          setModerationError(
            checkData?.reason ||
              checkError?.message ||
              t("ai_steps.text_moderation_failed") ||
              "Эълони шумо ба қоидаҳо мувофиқат намекунад.",
          );
          return;
        }

        // 1.5 Ин натиҷаи ҳамин санҷиши боло аст (is_document + privacy_regions)
        // — на даъвати AI-и нав. Агар ҳуҷҷат бошад, пеш аз боркунӣ корбар
        // минтақаҳои пешниҳодкардаи AI-ро мебинад ва метавонад бо қалам
        // иваз/илова кунад пеш аз тасдиқ. Экрани "муваффақият" танҳо БАЪД аз
        // тамом шудани ҳамаи блурҳо нишон дода мешавад — на пеш аз он.
        if (checkData?.is_document) {
          // Матни ниҳоӣ — рақами ҳуҷҷат/шиноснома аз матн нест карда шуд (AI),
          // ном/насаб бетағйир мемонад. Категория маҷбуран "Ҳуҷҷатҳо" мешавад,
          // новобаста аз он ки корбар кадом категорияро интихоб карда буд.
          finalTitle = checkData.redacted_title || formData.title;
          finalDescription = checkData.redacted_description || formData.description;
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
            return;
          }
          setImages(blurred);
          finalImages = blurred;
        }
      } catch (err: any) {
        setModerationStatus("failed");
        setModerationError(err.message);
        return;
      }
    } else {
      // AI moderation аз admin dashboard хомӯш карда шудааст (масалан
      // токени OpenAI тамом шудааст) — бе санҷиш, эълон бо ҳолати "дар
      // интизор" нашр мешавад: танҳо дар профили худи корбар намоён аст
      // (search_items RPC чунин филтр мекунад), то admin дастӣ тафтиш кунад.
      finalModerationStatus = "pending";
      finalModerationResult = "AI moderation хомӯш буд — дар интизори тасдиқи дастии admin";
    }

    // 1.6 Пеш аз худи нашр маслиҳати бехатариро нишон медиҳем — нашр
    // танҳо пас аз "Фаҳмидам" оғоз мешавад.
    setModerationStatus("idle");
    const proceed = await new Promise<boolean>((resolve) => {
      setSafetyAck({ resolve });
    });
    if (!proceed) {
      setStep(4);
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

    const publishWork = async () => {
      let token = await getToken({ template: "supabase" });
      if (!token) throw new Error("Authentication token missing");

      let supabase = createClerkSupabaseClient(token);

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

      const itemData = {
        user_id: userId,
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        type: formData.type,
        phone_number: formData.phone,
        reward:
          formData.type === "lost" && formData.reward
            ? `${formData.reward}`
            : null,
        date: new Date().toISOString().split("T")[0],
        is_resolved: false,
        moderation_status: finalModerationStatus,
        moderation_result: finalModerationResult,
      };

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert([itemData])
        .select()
        .single();
      if (itemError) throw itemError;

      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map((url) => ({
          item_id: item.id,
          image_url: url,
          embedding: null,
        }));

        const { error: imagesError } = await supabase
          .from("item_images")
          .insert(imageRecords);

        if (imagesError) {
          console.error("DATABASE ERROR:", imagesError.message);
        } else {
          // Vector-и visual-search бояд гум нашавад — на fire-and-forget.
          // Мунтазир мешавем ва як бор такрор мекунем, агар кӯшиши аввал
          // ноком шавад; агар боз ҳам ноком шавад, эълон аллакай нашр
          // шудааст (маводи АСОСӢ дар хатар нест), танҳо ҷустуҷӯи аксӣ
          // барои ин ашё кор намекунад — корбарро бо огоҳии мулоим хабар медиҳем.
          const embeddingText = `${itemData.title} ${itemData.description}`;
          let embeddingOk = false;
          for (let attempt = 0; attempt < 2 && !embeddingOk; attempt++) {
            const { error: embError } = await supabase.functions.invoke(
              "generate-embedding",
              {
                body: { item_id: item.id, text: embeddingText },
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

    publishWork().catch((error: any) => {
      console.error(error);
      toast.error(error.message || t("error"));
    });
  };

  return (
    <div className="container mx-auto px-0 sm:px-0 py-0 sm:py-0 max-w-none h-[calc(100vh-144px)] sm:h-[calc(100vh-64px)] flex flex-col">
      <Card className="flex-1 rounded-none overflow-hidden border-none shadow-none flex flex-col bg-white">
        {/* Step Indicator */}
        {/* Тартиби воқеии қадамҳо аз рӯи навигатсия 1→2→3→4→5 НЕСТ — қадами
            3 (санҷиши AI) охирин аст, танҳо ҳангоми нашр (onFinalSubmit)
            нишон дода мешавад: 1 → 2 → 4 → 5 → 3. Муқоисаи рақамии оддии
            step > i+1 нодуруст буд — вақте ки step=3 мешуд, қадамҳои 4 ва 5
            (ки аллакай гузашта буданд) хато холӣ (khokistarranga) нишон
            дода мешуданд. */}
        <div className="w-full flex h-1.5 gap-1 bg-zinc-50 dark:bg-zinc-900 overflow-hidden shrink-0">
          {stepOrder.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-full flex-1 transition-all duration-700 ease-in-out",
                stepIndex > i
                  ? "bg-emerald-500"
                  : stepIndex === i
                    ? "bg-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800",
              )}
            />
          ))}
        </div>

        <CardContent className="p-2 sm:p-4 md:p-6 lg:p-8 flex-1 flex flex-col justify-start pt-10 sm:pt-6 overflow-y-auto scrollbar-none">
          {/* Step 1: Photos First (Refined) */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full pt-4">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-2xl font-black tracking-tight text-zinc-800">
                  {t("pickImage")}
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-3">
                {images.length < 5 && (
                  <div
                    onClick={() => setShowPhotoChoice(true)}
                    className="aspect-square flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 cursor-pointer hover:bg-emerald-50/30 transition-all active:scale-95 group order-first shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="mt-2.5 text-[8px] font-black tracking-widest text-zinc-400 group-hover:text-emerald-600 transition-colors">
                      {t("pickImage")}
                    </span>
                  </div>
                )}
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl overflow-hidden group border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-sm"
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
                      className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 rounded-lg shadow-lg active:scale-90 transition-all z-20"
                    >
                      <X className="w-3 h-3" />
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
                <DialogContent className="max-w-[320px] rounded-[1.5rem] p-5 border-none shadow-2xl gap-4 focus:ring-0 focus:outline-none">
                  <DialogHeader className="mb-2">
                    <DialogTitle className="text-lg font-black tracking-tight text-center text-emerald-600">
                      {t("choose_photo_method")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-32 rounded-[1.2rem] border-none bg-blue-50/30 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        setShowCameraCapture(true);
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white transition-all shadow-sm">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-black tracking-widest text-blue-700">
                        {t("camera")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-32 rounded-[1.2rem] border-none bg-orange-50/30 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        galleryInputRef.current?.click();
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white transition-all shadow-sm">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-black tracking-widest text-orange-700">
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
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black tracking-tight">
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
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-5 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      🔍
                    </div>
                    <div className="flex-1">
                      <span className="block font-black text-lg leading-none mb-1">
                        {t("lost")}
                      </span>
                      <span className="text-zinc-500 text-[10px] font-bold">
                        {t("lost_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="lost"
                      id="lost"
                      className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-5 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      🎁
                    </div>
                    <div className="flex-1">
                      <span className="block font-black text-lg leading-none mb-1">
                        {t("found")}
                      </span>
                      <span className="text-zinc-500 text-[10px] font-bold">
                        {t("found_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="found"
                      id="found"
                      className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 3: AI Scanning & Auto-fill (Inline Visual Search Style) */}
          {step === 3 && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-500 max-w-5xl mx-auto w-full py-2 flex-1 flex flex-col justify-start pt-4 sm:pt-6">
              {moderationStatus === "checking" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative group w-full aspect-square max-w-[85vw] sm:max-w-[40vh] lg:max-w-[30vh]">
                    {/* Soft Glow */}
                    <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-2xl opacity-50 animate-pulse"></div>

                    {/* Image Container - Exact Visual Search Style */}
                    <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
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
                            <span className="text-[10px] font-black text-white tracking-widest whitespace-nowrap">
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
                  <div className="space-y-4 w-full px-6">
                    <div className="h-6 flex items-center justify-center">
                      <p
                        className="text-emerald-600 font-black text-[10px] sm:text-xs tracking-[0.2em] text-center animate-in slide-in-from-bottom-2 duration-700"
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
                <div className="space-y-6 text-center max-w-md mx-auto p-6 bg-red-50 rounded-[2.5rem] border border-red-100 shadow-sm">
                  <div className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center mx-auto shadow-sm">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-xl font-black tracking-tight text-red-600">
                      {t("ai_steps.step5_failed")}
                    </h2>
                    <div className="bg-white p-4 rounded-2xl border border-red-100">
                      <p className="text-red-700 font-bold text-sm leading-relaxed">
                        {moderationError || t("error")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Санҷиши ниҳоӣ акс+матнро якҷоя месанҷад — корбарро
                        // ба қадами форма (4) бармегардонем, то ислоҳ кунад.
                        setStep(4);
                        setModerationStatus("idle");
                      }}
                      className="rounded-xl font-bold text-[10px] tracking-widest mt-4 text-red-600 border-red-200 hover:bg-red-100"
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
                <div className="space-y-6 animate-in zoom-in duration-300 max-w-sm mx-auto w-full">
                  <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black tracking-tight text-emerald-600">
                      {t("success")}
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm tracking-tight">
                      {t("imageModeration.submitted")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(postSuccessRedirect)}
                    className="w-full h-14 rounded-2xl font-black tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                  >
                    {t("done")}
                  </Button>
                </div>
              )}

              {/* Idle — вақте ки корбар дар тирезаи блур аст (privacyReview
                  боз аст) ё AI натиҷаро аллакай пеш аз боркунии ниҳоӣ дод. */}
              {moderationStatus === "idle" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center mx-auto shadow-sm">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details (Auto-filled) */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black tracking-widest text-zinc-400 ml-1">
                  {t("titleLabel")}
                </Label>
                <Input
                  placeholder={t("titleLabel")}
                  className="rounded-xl h-12 bg-white border-zinc-200 text-sm font-bold focus-visible:border-emerald-500 shadow-none ring-2 ring-emerald-500/10"
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
                <Label className="text-[10px] font-black tracking-widest text-zinc-400 ml-1">
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
                        "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all active:scale-95 text-center",
                        formData.category === cat.name
                          ? "border-emerald-500 bg-emerald-50/30 text-emerald-700 shadow-sm"
                          : "border-zinc-100 bg-white hover:border-zinc-200 text-zinc-600",
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0",
                          formData.category === cat.name
                            ? "bg-emerald-100"
                            : "bg-zinc-50",
                        )}
                      >
                        {cat.icon}
                      </div>
                      <span className="text-[8px] font-black tracking-tight leading-tight">
                        {t(`categories.${cat.id}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black tracking-widest text-zinc-400 ml-1">
                  {t("description")}
                </Label>
                <Textarea
                  placeholder={t("description")}
                  className="rounded-xl min-h-[100px] bg-white border-zinc-200 text-sm font-medium focus-visible:border-emerald-500 shadow-none resize-none ring-2 ring-emerald-500/10"
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
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-2xl font-black tracking-tight">
                  {t("contactInfo") || "Contact Information"}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black tracking-widest text-zinc-400 ml-1">
                    {t("phoneLabel")}
                  </Label>
                  <Input
                    placeholder={t("phoneLabel")}
                    className="rounded-xl h-14 bg-white border-zinc-200 text-lg font-black px-5 focus-visible:border-emerald-500 transition-all"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    inputMode="numeric"
                    maxLength={9}
                  />
                </div>
                {formData.type === "lost" && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black tracking-widest text-zinc-400 ml-1">
                      {t("reward_gives_input")}
                    </Label>
                    <div className="relative">
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-sm text-zinc-400">
                        TJS
                      </span>
                      <Input
                        placeholder={t("reward_gives_input")}
                        className="rounded-xl h-14 bg-white border-zinc-200 text-lg font-black pr-14 pl-5 focus-visible:border-emerald-500 transition-all"
                        value={formData.reward}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            reward: e.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </CardContent>

        {/* Navigation Footer */}
        <div className="p-4 sm:p-10 bg-white shrink-0 border-t border-zinc-50">
          <div className="flex gap-3 sm:gap-4 items-center max-w-6xl mx-auto w-full">
            {step > 1 && step !== 3 && (
              <Button
                variant="outline"
                size="lg"
                onClick={prevStep}
                className="flex-1 rounded-2xl h-14 border-2 font-black tracking-widest text-[10px] hover:bg-zinc-50 transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("back")}
              </Button>
            )}
            {(step === 1 || step === 2 || step === 4) && (
              <Button
                size="lg"
                onClick={nextStep}
                className="flex-[1.5] rounded-2xl h-14 font-black tracking-widest text-[10px] bg-zinc-900 hover:bg-zinc-800 shadow-xl active:scale-95 transition-all"
              >
                {t("next")}
              </Button>
            )}
            {step === 5 && (
              <Button
                onClick={nextStep}
                disabled={loading}
                className="flex-[1.5] rounded-2xl h-14 bg-emerald-500 hover:bg-emerald-600 font-black tracking-widest text-[10px] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
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
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-7 space-y-5 text-center">
            <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto bg-red-50 animate-in zoom-in duration-500">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-black tracking-tight leading-snug">
                {formData.type === "found"
                  ? t("safetyPostModal.foundTitle")
                  : t("safetyPostModal.lostTitle")}
              </DialogTitle>
              <p className="text-zinc-500 font-bold text-[13px] leading-relaxed">
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
              className="w-full h-14 rounded-2xl font-black tracking-widest text-xs text-white bg-emerald-500 hover:bg-emerald-600 shadow-xl"
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
