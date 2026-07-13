"use client";

/**
 * Саҳифаи таҳрири эълон.
 * Оптимизатсияшуда барои суръат ва сифати AI.
 */

import { useEffect, useState, use } from "react"; // Барои кор бо стейт ва эффектҳо
import { useRouter } from "next/navigation"; // Барои гузаштан ба саҳифаҳои дигар
import { useAuth } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { ItemService, CATEGORIES, Item } from "@/lib/services/item-service"; // Барои кор бо эълонҳо
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Компоненти воридкунии матн
import { Textarea } from "@/components/ui/textarea"; // Компоненти воридкунии матни дароз
import { Label } from "@/components/ui/label"; // Компоненти тамға
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Барои интихоби як аз якчандто
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Барои рӯйхати интихобшаванда
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Компоненти корт
import { toast } from "sonner"; // Барои нишон додани хабарҳо
import { Loader2, Plus, X, Upload, ShieldAlert, ArrowLeft } from "lucide-react"; // Иконкаҳо
import Image from "next/image"; // Барои суратҳо
import Link from "next/link"; // Барои гузаштан ба саҳифаҳо
import { compressImage } from "@/lib/image-utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳо

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ID-и эълонро аз URL мегирем
  const { id } = use(params);
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();

  // Стейтҳо барои нигоҳ доштани маълумоти эълон ва ҳолати боргузорӣ (Loading)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);

  // Стейтҳо барои навъи ашё, категория ва суратҳо
  const [type, setType] = useState<"lost" | "found">("lost");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<
    { url: string; isExisting: boolean }[]
  >([]);

  // Стейтҳои модерация (AI Moderation States)
  const [moderationStatus, setModerationStatus] = useState<
    "idle" | "checking" | "passed" | "failed"
  >("idle");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    let timer: any;

    if (moderationStatus === "checking") {
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
      interval = setInterval(() => {
        stepCount++;
        if (stepCount % 6 === 3) {
          setScanMessage(t("ai_steps.please_wait"));
        } else if (stepCount % 6 === 0) {
          setScanMessage(t("ai_steps.do_not_exit"));
        } else {
          const techIndex = Math.floor(stepCount / 2) % technicalSteps.length;
          setScanMessage(technicalSteps[techIndex]);
        }
      }, 3000);

      timer = setInterval(() => {
        setElapsedSeconds((prev) => Math.min(prev + 1, 120));
      }, 1000);
    } else {
      setElapsedSeconds(0);
      setActiveImageIndex(0);
      setScanMessage("");
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearInterval(timer);
    };
  }, [moderationStatus, previews.length, t]);

  // Вақте ки саҳифа кушода мешавад, маълумоти эълонро аз база мехонем
  useEffect(() => {
    if (userId) loadItem();
  }, [id, userId]);

  /**
   * Функсия барои гирифтани маълумоти эълон аз база
   */
  const loadItem = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);

      const { data, error } = await supabase
        .from("items")
        .select("*, images:item_images(image_url)")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Агар корбар соҳиби эълон набошад, вайро ба главний мефиристем
      if (data.user_id !== userId) {
        toast.error(t("accessDenied"));
        router.push("/");
        return;
      }

      setItem(data);
      setType(data.type);
      setCategory(data.category);
      if (data.images) {
        setPreviews(
          data.images.map((img: any) => ({
            url: img.image_url,
            isExisting: true,
          })),
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(t("itemNotFound"));
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Функсия барои коркарди суратҳои нави интихобшуда
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (previews.length + files.length > 5) {
      toast.error(t("maxImagesReached"));
      return;
    }

    setImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => ({
      url: URL.createObjectURL(file),
      isExisting: false,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  /**
   * Функсия барои нест кардани сурат аз рӯйхати пешнамоиш (Preview)
   */
  const removeImage = (index: number) => {
    const previewToRemove = previews[index];
    if (!previewToRemove.isExisting) {
      const fileIndex = previews.filter(
        (p, i) => i < index && !p.isExisting,
      ).length;
      setImages((prev) => prev.filter((_, i) => i !== fileIndex));
    }
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Функсия барои модерацияи AI (Танҳо барои аксҳои нав)
   */
  const runAIModeration = async (
    newFiles: File[],
    currentTitle: string,
    currentDesc: string,
  ) => {
    setModerationStatus("checking");
    setModerationError(null);

    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);

      const formDataAI = new FormData();

      // Мо танҳо файлҳои навро барои тафтиш мефиристем
      newFiles.forEach((file) => {
        formDataAI.append("image", file);
      });

      formDataAI.append("lang", locale);
      formDataAI.append("type", type);
      formDataAI.append("title", currentTitle);
      formDataAI.append("description", currentDesc);
      formDataAI.append("mode", "moderation_only");

      const { data, error } = await supabase.functions.invoke("ai-brain", {
        body: formDataAI,
      });

      if (error || (data && data.is_safe === false)) {
        setModerationStatus("failed");
        setModerationError(data?.reason || error?.message || t("error"));
        return false;
      }

      setModerationStatus("passed");
      setScanMessage(t("ai_steps.images_passed") || "Аксҳо қабул шуданд!");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    } catch (error: any) {
      console.error("AI Moderation Error:", error);
      setModerationStatus("failed");
      setModerationError(error.message);
      return false;
    }
  };

  /**
   * Функсия барои модерацияи матн (Танҳо барои матни ивазшуда)
   */
  const runTextModeration = async (title: string, description: string) => {
    setModerationStatus("checking");
    setModerationError(null);
    setScanMessage(
      t("ai_steps.checking_custom_text") || "AI матни нави шуморо месанҷад...",
    );

    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);

      const { data, error } = await supabase.functions.invoke(
        "text-moderation",
        {
          body: {
            record: { title, description, moderation_status: "pending" },
            lang: locale,
          },
        },
      );

      if (error || (data && data.is_safe === false)) {
        setModerationStatus("failed");
        setModerationError(data?.reason || error?.message || t("error"));
        return false;
      }

      setModerationStatus("passed");
      setScanMessage(t("ai_steps.text_passed") || "Матн қабул шуд!");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    } catch (error: any) {
      console.error("Text Moderation Error:", error);
      setModerationStatus("failed");
      setModerationError(error.message);
      return false;
    }
  };

  /**
   * Функсияи асосӣ барои сабт кардани тағйирот (Update)
   */
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId || !item) return;

    // Маълумотро аз форма мегирем
    const formData = new FormData(e.currentTarget);
    const title = ((formData.get("title") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const rewardField = formData.get("reward");
    const reward = rewardField ? (rewardField as string).trim() : null;

    // Месанҷем, ки ҳамаи майдонҳо пур шудаанд
    if (!title || !description || !category || !phone) {
      toast.error(t("fillAllFields"));
      return;
    }

    if (previews.length === 0) {
      toast.error(t("atLeastOneImage"));
      return;
    }

    const hasNewImages = images.length > 0;
    const textChanged =
      title !== item.title || description !== item.description;

    setSaving(true);
    try {
      let token = await getToken({ template: "supabase" });
      if (!token) throw new Error("Authentication token missing");

      let supabase = createClerkSupabaseClient(token);

      // МОДЕРАТСИЯИ МАҶБУРӢ
      if (hasNewImages) {
        // Агар акси нав бошад, AI Brain ҳардуро месанҷад (акс + матн)
        const isSafe = await runAIModeration(images, title, description);
        if (!isSafe) {
          setSaving(false);
          return;
        }
      } else if (textChanged) {
        // Агар танҳо матн иваз шуда бошад
        const isSafe = await runTextModeration(title, description);
        if (!isSafe) {
          setSaving(false);
          return;
        }
      }

      setSaving(true); // Re-confirm saving state after moderation

      const existingUrls = item.images?.map((img) => img.image_url) || [];
      const imagesChanged =
        hasNewImages ||
        previews.length !== existingUrls.length ||
        previews.some((p, i) => p.isExisting && p.url !== existingUrls[i]);

      // 1. Боргузории суратҳои нав ба Облако (Storage)
      const finalImageUrls: string[] = [];
      const newFiles = images;
      let newFileIdx = 0;

      for (const preview of previews) {
        if (preview.isExisting) {
          finalImageUrls.push(preview.url);
        } else {
          const file = newFiles[newFileIdx++];
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
          finalImageUrls.push(publicUrl);
        }
      }

      token = await getToken({ template: "supabase" });
      if (!token) throw new Error("Authentication token expired or missing");
      supabase = createClerkSupabaseClient(token);

      // 2. Нав кардани маълумоти эълон дар база (Update query)
      const updateData: any = {
        title,
        description,
        category,
        type,
        phone_number: phone,
        reward: reward ? `${reward}` : null,
        moderation_status: "approved", // Чун AI аллакай тафтиш кард
      };

      const { error: updateError } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;

      // 3. Тоза кардани суратҳои кӯҳна ва сабти суратҳои нав
      if (imagesChanged) {
        const removedUrls = existingUrls.filter(
          (url) => !finalImageUrls.includes(url),
        );

        if (removedUrls.length > 0) {
          const filePaths = removedUrls
            .map((urlStr) => {
              try {
                const url = new URL(urlStr);
                const pathParts = url.pathname.split("/public/items/");
                return pathParts.length > 1 ? pathParts[1] : null;
              } catch (e) {
                const parts = urlStr.split("/public/items/");
                return parts.length > 1 ? parts[1].split("?")[0] : null;
              }
            })
            .filter(Boolean) as string[];

          if (filePaths.length > 0) {
            await supabase.storage.from("items").remove(filePaths);
          }
        }

        await supabase.from("item_images").delete().eq("item_id", id);

        const imageRecords = finalImageUrls.map((url) => ({
          item_id: id,
          image_url: url,
        }));

        const { error: imagesError } = await supabase
          .from("item_images")
          .insert(imageRecords);
        if (imagesError)
          console.error("DATABASE ERROR (item_images):", imagesError.message);
      }

      // 4. ТАҶДИДИ ВЕКТОРИ ҶУСТУҶӮ (Vector/Embedding Update)
      // Ҳамеша embedding-ро аз нав месозем, то visual search кор кунад
      // image_url истифода мешавад барои forensic description (мувофиқтар бо visual search)
      const firstImageUrl = finalImageUrls[0];
      supabase.functions
        .invoke("generate-embedding", {
          body: {
            item_id: id,
            ...(firstImageUrl
              ? { image_url: firstImageUrl }
              : { text: `${title} ${description}` }),
          },
        })
        .catch((err) =>
          console.error("Background embedding failed (Edit):", err),
        );

      toast.success(t("updateSuccess"));
      router.push(`/items/${id}`);
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t("error"));
      // Агар хатогии техникӣ шавад, ба ҳолати аслӣ бармегардем
      setModerationStatus("idle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Агар дар ҳолати скан кардан бошад, интерфейси Step 3-ро нишон медиҳем
  if (moderationStatus !== "idle") {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-start pt-10 sm:pt-16 px-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          {moderationStatus === "checking" && (
            <div className="space-y-6">
              <div className="relative group w-full aspect-square max-w-[220px] sm:max-w-[280px] lg:max-w-[220px] mx-auto">
                <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
                  <div className="relative h-full w-full">
                    {previews[activeImageIndex] && (
                      <>
                        <Image
                          src={previews[activeImageIndex].url}
                          alt=""
                          fill
                          className="object-cover blur-3xl opacity-40 scale-110"
                        />
                        <Image
                          src={previews[activeImageIndex].url}
                          alt="Analyzing"
                          fill
                          className="object-contain opacity-60 transition-all duration-1000 relative z-10"
                          key={activeImageIndex}
                        />
                      </>
                    )}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-scan-fast" />
                    </div>
                    <div
                      className="absolute inset-0 opacity-90 animate-grid-scan z-10 pointer-events-none"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgba(52, 211, 153, 1) 1.5px, transparent 1.5px)",
                        backgroundSize: "25px 25px",
                      }}
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-white tracking-widest">
                        {elapsedSeconds}с / 60с
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-6 flex items-center justify-center">
                <p
                  className="text-emerald-600 font-black text-xs tracking-[0.2em] animate-in slide-in-from-bottom-2 duration-700"
                  key={scanMessage}
                >
                  {scanMessage}
                </p>
              </div>
            </div>
          )}

          {moderationStatus === "failed" && (
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto shadow-sm">
                <ShieldAlert className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-black tracking-tight text-red-600">
                  {t("ai_steps.step5_failed")}
                </h2>
                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                  <p className="text-red-700 font-bold text-sm leading-relaxed">
                    {moderationError || t("error")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setModerationStatus("idle")}
                  className="rounded-xl font-bold text-[10px] tracking-widest mt-4 text-red-600 border-red-200 hover:bg-red-100 h-12 px-8"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />{" "}
                  {t("ai_steps.step5_fix_btn")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <style jsx global>{`
          @keyframes scan-fast {
            0% {
              top: 0;
            }
            100% {
              top: 100%;
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
          .animate-grid-scan {
            animation: grid-scan 1.5s linear infinite !important;
          }
        `}</style>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="rounded-2xl overflow-hidden border shadow-xl">
          {/* Сарлавҳаи форма */}
          <CardHeader className="bg-zinc-900 text-white p-6">
            <CardTitle className="text-2xl font-black tracking-tight">
              {t("editItemTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Интихоби навъи эълон (Радио-кнопкаҳо) */}
              <div className="space-y-3">
                <Label className="text-sm font-black tracking-wider text-zinc-400">
                  {t("what_happened")}
                </Label>
                <RadioGroup
                  value={type}
                  onValueChange={(val) => setType(val as "lost" | "found")}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="lost"
                      id="lost"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="lost"
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all"
                    >
                      <span className="text-2xl mb-1">🔍</span>
                      <span className="font-bold text-sm">{t("lost")}</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="found"
                      id="found"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="found"
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                    >
                      <span className="text-2xl mb-1">🎁</span>
                      <span className="font-bold text-sm">{t("found")}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Майдонҳои асосии маълумот (Title, Category, Description) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="font-bold text-xs text-zinc-500"
                  >
                    {t("titleLabel")}
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={item?.title}
                    placeholder={t("titleLabel")}
                    className="rounded-lg h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="category"
                    className="font-bold text-xs text-zinc-500"
                  >
                    {t("categoryLabel")}
                  </Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="h-11 rounded-lg">
                      <SelectValue placeholder={t("categoryLabel")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {CATEGORIES.map((cat) => (
                        <SelectItem
                          key={cat.id}
                          value={cat.name}
                          className="rounded-md"
                        >
                          {cat.icon} {t(`categories.${cat.id}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="font-bold text-xs text-zinc-500"
                >
                  {t("description")}
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={item?.description}
                  placeholder={t("description")}
                  className="rounded-lg min-h-[100px] resize-none"
                  required
                />
              </div>

              {/* Телефон ва Мукофотпулӣ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="font-bold text-xs text-zinc-500"
                  >
                    {t("phoneLabel")}
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={item?.phone_number}
                    placeholder={t("phonePlaceholder")}
                    className="rounded-lg h-11"
                    required
                    type="text"
                    inputMode="numeric"
                    onChange={(e) =>
                      (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
                {type === "lost" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Label
                      htmlFor="reward"
                      className="font-bold text-xs text-zinc-500"
                    >
                      {t("reward_gives_input")}
                    </Label>
                    <Input
                      id="reward"
                      name="reward"
                      defaultValue={item?.reward?.replace(/[^0-9]/g, "")}
                      placeholder={t("rewardPlaceholder")}
                      className="rounded-lg h-11"
                      type="text"
                      inputMode="numeric"
                      onChange={(e) =>
                        (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Қисмати идоракунии суратҳо (Image Upload) */}
              <div className="space-y-4">
                <Label className="font-bold text-xs text-zinc-500">
                  {t("addImages")} ({previews.length}/5)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {previews.map((preview, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-lg overflow-hidden border group"
                    >
                      <Image
                        src={preview.url}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 rounded-lg shadow-lg active:scale-90 transition-all z-20 border border-zinc-100 dark:border-zinc-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {previews.length < 5 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                          <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                          <span className="text-[8px] text-zinc-400 font-bold">
                            {t("pickImage")}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                          />
                        </label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("maxImages")}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Тугмаи сабт (Submit button) */}
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 rounded-lg text-base font-black bg-zinc-900 hover:bg-zinc-800 mt-4 tracking-wider text-white"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t("loading")}
                  </>
                ) : (
                  t("updateBtn")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
