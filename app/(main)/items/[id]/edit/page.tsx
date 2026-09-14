"use client";

/**
 * Item edit page.
 * Optimized for speed and AI quality.
 */

import { useEffect, useState, useCallback, use } from "react"; // For working with state and effects
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation"; // For navigating to other pages
import { useAuth } from "@clerk/nextjs"; // For getting user data
import { useLanguage } from "@/lib/language-context"; // For language translation
import { CATEGORIES, Item, UNSPECIFIED_REWARD } from "@/lib/services/item-service"; // For working with listings
import { createClerkSupabaseClient, supabase as anonSupabase } from "@/lib/supabase"; // For connecting to the database
import { Button } from "@/components/ui/button"; // Button component
import { Input } from "@/components/ui/input"; // Text input component
import { Textarea } from "@/components/ui/textarea"; // Long text input component
import { Label } from "@/components/ui/label"; // Label component
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // For selecting one of several options
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // For a selectable list
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Card component
import { toast } from "sonner"; // For showing messages
import { Loader2, X, Upload, ShieldAlert, ArrowLeft } from "lucide-react"; // Icons
import Image from "next/image"; // For images
import { compressImage } from "@/lib/image-utils";
import type { PrivacyRegion } from "@/components/privacy-blur-editor";
import { TelegramIcon, WhatsappIcon } from "@/components/social-icons";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // For showing tooltips

const PrivacyBlurEditor = dynamic(() =>
  import("@/components/privacy-blur-editor").then((m) => m.PrivacyBlurEditor),
);

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Get the listing ID from the URL
  const { id } = use(params);
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();

  // States for holding listing data and the loading state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);

  // States for item type, category, and images
  const [type, setType] = useState<"lost" | "found">("lost");
  const [category, setCategory] = useState("");
  const [locationType, setLocationType] = useState<
    "taxi" | "hotel_restaurant" | "public_place" | "airport" | null
  >(null);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [contactTelegram, setContactTelegram] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<
    { url: string; isExisting: boolean }[]
  >([]);

  // Privacy protection editor — see items/add/page.tsx
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    regions: PrivacyRegion[];
    resolve: (result: File[] | null) => void;
  } | null>(null);

  // Moderation states (AI Moderation States)
  const [moderationStatus, setModerationStatus] = useState<
    "idle" | "checking" | "passed" | "failed"
  >("idle");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Defaults to true (until settings load) — see items/add/page.tsx for the
  // full explanation. If it's off, we skip the AI check in edit too (no
  // point spending on OpenAI) — the listing stays in "pending" status.
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
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

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

  /**
   * Function for fetching listing data from the database
   */
  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClerkSupabaseClient(getToken);

      const { data, error } = await supabase
        .from("items")
        .select("*, images:item_images(image_url)")
        .eq("id", id)
        .single();

      if (error) throw error;

      // If the user isn't the owner of the listing, redirect them to the home page
      if (data.user_id !== userId) {
        toast.error(t("accessDenied"));
        router.push("/");
        return;
      }

      setItem(data);
      setType(data.type);
      setCategory(data.category);
      setLocationType(data.location_type ?? null);
      setRewardEnabled(!!data.reward);
      setContactTelegram(!!data.contact_telegram);
      setContactWhatsapp(!!data.contact_whatsapp);
      if (data.images) {
        setPreviews(
          data.images.map((img: { image_url: string }) => ({
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
  }, [id, userId, getToken, router, t]);

  // When the page opens, load the listing data from the database
  useEffect(() => {
    if (userId) loadItem();
  }, [userId, loadItem]);

  /**
   * Function for handling newly selected images
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
   * Function for removing an image from the preview list
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
   * Function for AI moderation (only for new images)
   */
  const runAIModeration = async (
    newFiles: File[],
    currentTitle: string,
    currentDesc: string,
  ) => {
    setModerationStatus("checking");
    setModerationError(null);

    try {
      const supabase = createClerkSupabaseClient(getToken);

      const formDataAI = new FormData();

      // We only send the new files for checking
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
        return { isSafe: false, isDocument: false, privacyRegions: [] as PrivacyRegion[], redactedTitle: currentTitle, redactedDescription: currentDesc };
      }

      setModerationStatus("passed");
      setScanMessage(t("ai_steps.images_passed") || "Аксҳо қабул шуданд!");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        isSafe: true,
        isDocument: !!data?.is_document,
        privacyRegions: (data?.privacy_regions ?? []) as PrivacyRegion[],
        redactedTitle: (data?.redacted_title as string) || currentTitle,
        redactedDescription: (data?.redacted_description as string) || currentDesc,
      };
    } catch (error) {
      console.error("AI Moderation Error:", error);
      setModerationStatus("failed");
      setModerationError(error instanceof Error ? error.message : String(error));
      return { isSafe: false, isDocument: false, privacyRegions: [] as PrivacyRegion[], redactedTitle: currentTitle, redactedDescription: currentDesc };
    }
  };

  /**
   * Function for text moderation (only for changed text)
   */
  const runTextModeration = async (title: string, description: string) => {
    setModerationStatus("checking");
    setModerationError(null);
    setScanMessage(
      t("ai_steps.checking_custom_text") || "AI матни нави шуморо месанҷад...",
    );

    try {
      const supabase = createClerkSupabaseClient(getToken);

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
    } catch (error) {
      console.error("Text Moderation Error:", error);
      setModerationStatus("failed");
      setModerationError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  /**
   * Main function for saving changes (Update)
   */
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId || !item) return;

    // Get data from the form
    const formData = new FormData(e.currentTarget);
    const title = ((formData.get("title") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const rewardField = formData.get("reward");
    const reward = rewardEnabled
      ? (rewardField as string | null)?.trim() || UNSPECIFIED_REWARD
      : null;

    // Check that all fields are filled in
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
      const supabase = createClerkSupabaseClient(getToken);

      let finalImages = images;
      let finalTitle = title;
      let finalDescription = description;
      let finalCategory = category;

      const contentChanged = hasNewImages || textChanged;

      // MANDATORY MODERATION — only if AI is enabled by the admin and
      // something has actually changed. If AI is off, we don't call OpenAI at
      // all (pointless) — the listing stays "pending", awaiting the admin.
      if (aiModerationEnabled && hasNewImages) {
        // If there's a new image, AI Brain checks both (image + text)
        const { isSafe, isDocument, privacyRegions, redactedTitle, redactedDescription } = await runAIModeration(images, title, description);
        if (!isSafe) {
          setSaving(false);
          return;
        }
        // This is the result of the same check above (is_document +
        // privacy_regions) — not a new AI call. If it's a document, the user
        // sees the regions AI suggested and can edit/add to them with the pen tool.
        if (isDocument) {
          // The document/passport number was removed from the text, name/surname unchanged.
          finalTitle = redactedTitle;
          finalDescription = redactedDescription;
          finalCategory = "Documents";

          setModerationStatus("idle");
          const blurred = await new Promise<File[] | null>((resolve) => {
            setPrivacyReview({ files: images, regions: privacyRegions, resolve });
          });
          if (!blurred) {
            // User canceled — we stop saving, so an unblurred image doesn't get published.
            setSaving(false);
            return;
          }
          finalImages = blurred;
          setImages(blurred);
        }
      } else if (aiModerationEnabled && textChanged) {
        // If only the text was changed
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

      // 1. Upload new images to the Cloud (Storage)
      const finalImageUrls: string[] = [];
      const newFiles = finalImages;
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

      // 2. Update the listing data in the database (Update query)
      const updateData: Omit<Partial<Item>, "reward"> & { reward: string | null } = {
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        type,
        phone_number: phone,
        contact_telegram: contactTelegram,
        contact_whatsapp: contactWhatsapp,
        reward: reward ? `${reward}` : null,
        // If AI is off and something has actually changed, it stays
        // "pending" (awaiting admin) — otherwise AI has already checked it.
        moderation_status: !aiModerationEnabled && contentChanged ? "pending" : "approved",
        location_type: locationType,
      };

      const { error: updateError } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;

      // 3. Remove old images and save new images
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
              } catch {
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

      // 4. SEARCH VECTOR REFRESH (Vector/Embedding Update)
      // We always regenerate the embedding, so visual search keeps working.
      // generate-embedding fetches the images ITSELF from item_images (all of them).
      // `force` is needed because if the user only changed the title/description,
      // the image rows weren't updated and the old vector would remain.
      supabase.functions
        .invoke("generate-embedding", {
          body: {
            item_id: id,
            text: `${finalTitle} ${finalDescription}`,
            force: true,
          },
        })
        .catch((err) =>
          console.error("Background embedding failed (Edit):", err),
        );

      toast.success(t("updateSuccess"));
      if (!aiModerationEnabled && contentChanged) {
        // AI is off — the listing became "pending", awaiting admin. We take
        // the user to their profile (not to the listing's own page), so they
        // see "under review" in "My Listings".
        router.push("/profile?tab=posts");
      } else {
        router.push(`/items/${id}`);
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("error"));
      // If a technical error occurs, revert to the original state
      setModerationStatus("idle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2.5 sm:px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // If we're in scanning state, show the Step 3 interface
  if (moderationStatus !== "idle") {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-start pt-10 sm:pt-16 px-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          {moderationStatus === "checking" && (
            <div className="space-y-6">
              <div className="relative group w-full aspect-square max-w-[220px] sm:max-w-[280px] lg:max-w-[220px] mx-auto">
                <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative h-full w-full rounded-3xl overflow-hidden border border-zinc-100 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
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
                      <span className="text-[10px] font-bold text-white tracking-widest">
                        {elapsedSeconds}с / 60с
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-6 flex items-center justify-center">
                <p
                  className="text-emerald-600 font-bold text-xs tracking-[0.2em]"
                  key={scanMessage}
                >
                  {scanMessage}
                </p>
              </div>
            </div>
          )}

          {moderationStatus === "failed" && (
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto shadow-sm">
                <ShieldAlert className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight text-red-600">
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
      <div className="mx-auto w-full max-w-7xl px-2.5 sm:px-4 py-8 max-w-2xl">
        <Card className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.08)] dark:shadow-none">
          {/* Form header */}
          <CardHeader className="bg-emerald-600 text-white p-6">
            <CardTitle className="text-2xl min-[1084px]:text-3xl min-[1920px]:text-[32px] font-bold tracking-tight">
              {t("editItemTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Listing type selection (Radio buttons) */}
              <div className="space-y-3">
                <Label className="text-sm min-[1084px]:text-base font-bold tracking-wider text-zinc-400">
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
                      <span className="text-2xl min-[1084px]:text-3xl mb-1">🔍</span>
                      <span className="font-bold text-sm min-[1084px]:text-base">{t("lost")}</span>
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
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-white dark:peer-data-[state=checked]:bg-zinc-900 cursor-pointer transition-all"
                    >
                      <span className="text-2xl min-[1084px]:text-3xl mb-1">🎁</span>
                      <span className="font-bold text-sm min-[1084px]:text-base">{t("found")}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Main data fields (Title, Category, Description) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
                  >
                    {t("titleLabel")}
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={item?.title}
                    placeholder={t("titleLabel")}
                    className="rounded-lg h-11 min-[1084px]:h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="category"
                    className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
                  >
                    {t("categoryLabel")}
                  </Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="h-11 min-[1084px]:h-12 rounded-lg">
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
                  htmlFor="locationType"
                  className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
                >
                  {t("addItemLocationStep.title")}
                </Label>
                <Select
                  value={locationType ?? "none"}
                  onValueChange={(val) =>
                    setLocationType(
                      val === "none"
                        ? null
                        : (val as "taxi" | "hotel_restaurant" | "public_place" | "airport"),
                    )
                  }
                >
                  <SelectTrigger className="h-11 min-[1084px]:h-12 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none" className="rounded-md">
                      {t("addItemLocationStep.notSpecified")}
                    </SelectItem>
                    <SelectItem value="taxi" className="rounded-md">
                      {t("addItemLocationStep.taxi")}
                    </SelectItem>
                    <SelectItem value="airport" className="rounded-md">
                      {t("addItemLocationStep.airport")}
                    </SelectItem>
                    <SelectItem value="hotel_restaurant" className="rounded-md">
                      {t("addItemLocationStep.hotel_restaurant")}
                    </SelectItem>
                    <SelectItem value="public_place" className="rounded-md">
                      {t("addItemLocationStep.public_place")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
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

              {/* Phone and Reward */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
                  >
                    {t("phoneLabel")}
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={item?.phone_number}
                    placeholder={t("phonePlaceholder")}
                    className="rounded-lg h-11 min-[1084px]:h-12"
                    required
                    type="text"
                    inputMode="numeric"
                    onChange={(e) =>
                      (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Checkbox
                      checked={contactTelegram}
                      onCheckedChange={(checked) => setContactTelegram(checked === true)}
                    />
                    <TelegramIcon size={18} />
                    <span className="font-bold text-xs min-[1084px]:text-sm text-zinc-500">
                      {t("contactViaTelegram")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Checkbox
                      checked={contactWhatsapp}
                      onCheckedChange={(checked) => setContactWhatsapp(checked === true)}
                    />
                    <WhatsappIcon size={18} />
                    <span className="font-bold text-xs min-[1084px]:text-sm text-zinc-500">
                      {t("contactViaWhatsapp")}
                    </span>
                  </label>
                </div>
                {type === "lost" && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <Checkbox
                        checked={rewardEnabled}
                        onCheckedChange={(checked) =>
                          setRewardEnabled(checked === true)
                        }
                      />
                      <span className="font-bold text-xs min-[1084px]:text-sm text-zinc-500">
                        {t("reward_gives")}
                      </span>
                    </label>
                    {rewardEnabled && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="reward"
                          className="font-bold text-xs min-[1084px]:text-sm text-zinc-500"
                        >
                          {t("reward_gives_input")}
                        </Label>
                        <Input
                          id="reward"
                          name="reward"
                          defaultValue={item?.reward?.replace(/[^0-9]/g, "")}
                          placeholder={t("rewardPlaceholder")}
                          className="rounded-lg h-11 min-[1084px]:h-12"
                          type="text"
                          inputMode="numeric"
                          onChange={(e) =>
                            (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Image management section (Image Upload) */}
              <div className="space-y-4">
                <Label className="font-bold text-xs min-[1084px]:text-sm text-zinc-500">
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
                        className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 rounded-lg shadow-lg transition-all z-20 border border-zinc-100 dark:border-zinc-800"
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

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 min-[1084px]:h-14 rounded-lg text-base min-[1084px]:text-lg font-bold bg-emerald-500 hover:bg-emerald-600 mt-4 tracking-wider text-white"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 min-[1084px]:h-6 min-[1084px]:w-6 animate-spin" />
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
    </TooltipProvider>
  );
}
