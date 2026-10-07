"use client";

/**
 * Item edit page.
 */

import { useEffect, useState, useCallback, use } from "react"; // For working with state and effects
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation"; // For navigating to other pages
import { useAuth } from "@clerk/nextjs"; // For getting user data
import { useLanguage } from "@/lib/language-context"; // For language translation
import { CATEGORIES, Item, UNSPECIFIED_REWARD } from "@/lib/services/item-service"; // For working with listings
import { createClerkSupabaseClient } from "@/lib/supabase"; // For connecting to the database
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
import { Loader2, X, Upload, EyeOff } from "lucide-react"; // Icons
import Image from "next/image"; // For images
import { compressImage } from "@/lib/image-utils";
import { isDocumentCategory, maskSensitiveNumbers } from "@/lib/sensitive-text";
import { warmPhotoAnalysis } from "@/lib/photo-privacy";
import { isSafeFor, markReviewed, preparePhotos } from "@/lib/prepare-photos";
import { DOCUMENT_CATEGORIES, type Rect } from "@/lib/privacy-pipeline";
import { CITY_IDS, DEFAULT_CITY, cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";
import { TelegramIcon, WhatsappIcon } from "@/components/social-icons";
import { attachEmbeddings } from "@/lib/visual-search";
import { isNoPhotoCategory, isPlaceholderUrl, placeholderImageUrl } from "@/lib/photo-policy";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // For showing tooltips

const PrivacyBlurEditor = dynamic(() =>
  import("@/components/privacy-blur-editor").then((m) => m.PrivacyBlurEditor),
);

// Same place list as items/add and the home filter (and mobile), so a listing
// can be edited to any place it could have been created with.
const EDIT_LOCATION_TYPES = [
  "taxi", "airport", "hotel_restaurant", "public_place", "gym", "university",
  "mall", "office", "tourism", "bank",
] as const;
type EditLocationType = (typeof EDIT_LOCATION_TYPES)[number];

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
  const [locationType, setLocationType] = useState<EditLocationType | null>(null);
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [contactTelegram, setContactTelegram] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<
    { url: string; isExisting: boolean }[]
  >([]);

  // Privacy editor — opened by the person for NEW photos, or by the privacy
  // pipeline when a photo needs a person's check (see items/add/page.tsx).
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    documentMode: boolean;
    initialRegions?: (Rect[] | null)[];
    resolve: (result: { files: File[]; covers: Rect[][] } | null) => void;
  } | null>(null);
  // Start the analysis as soon as a photo is there, so saving rarely waits.
  useEffect(() => {
    images.forEach(warmPhotoAnalysis);
  }, [images]);

  const openPrivacyEditor = (files: File[], documentMode: boolean, initialRegions?: (Rect[] | null)[]) =>
    new Promise<{ files: File[]; covers: Rect[][] } | null>((resolve) => {
      setPrivacyReview({ files, documentMode, initialRegions, resolve });
    });

  // Switching a listing INTO Documents/Cards re-checks its current photos:
  // they are fetched, go through the pipeline like new ones, and are then
  // replaced (the old files deleted, like any removed photo).
  const existingAsNewFiles = async (): Promise<File[] | null> => {
    try {
      let newIdx = 0;
      return await Promise.all(
        previews.map(async (p) => {
          if (!p.isExisting) return images[newIdx++];
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          return new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
        }),
      );
    } catch {
      toast.error(t("error"));
      return null;
    }
  };

  /**
   * Function for fetching listing data from the database
   */
  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClerkSupabaseClient(getToken);

      const { data, error } = await supabase
        .from("items")
        .select("*, images:item_images(image_url, thumbnail_url)")
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
      setCity(data.city ?? DEFAULT_CITY);
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

    // Documents/Cards keep no photo at all (lib/photo-policy.ts): the old
    // photo files are deleted below and the listing shows the JUYO image.
    const noPhoto = isNoPhotoCategory(category);
    const realPreviews = previews.filter((p) => !isPlaceholderUrl(p.url));
    if (!noPhoto && realPreviews.length === 0) {
      toast.error(t("atLeastOneImage"));
      return;
    }

    let currentImages = noPhoto ? [] : images;
    let currentPreviews = noPhoto ? [] : realPreviews;
    const isDocCat = (c: string | null | undefined) => !!c && DOCUMENT_CATEGORIES.includes(c);
    if (!noPhoto && isDocCat(category) && !isDocCat(item?.category) && realPreviews.some((p) => p.isExisting)) {
      const all = await existingAsNewFiles();
      if (!all) return;
      currentImages = all;
      currentPreviews = all.map(() => ({ url: "", isExisting: false }));
    }
    // Every new photo passes the in-browser privacy pipeline; only its safe
    // output is uploaded.
    if (currentImages.some((f) => !isSafeFor(f, category))) {
      setSaving(true);
      let outcome;
      try {
        outcome = await preparePhotos(currentImages, category, openPrivacyEditor);
      } finally {
        setSaving(false);
      }
      currentImages = outcome.files;
      let idx = 0;
      // Refused photos (a person) leave outcome.files shorter than the new previews.
      currentPreviews = currentPreviews.flatMap((p) => {
        if (p.isExisting) return [p];
        const f = outcome.files[idx++];
        return f ? [{ url: URL.createObjectURL(f), isExisting: false }] : [];
      });
      setImages(currentImages);
      setPreviews((prev) => {
        prev.forEach((pv) => !pv.isExisting && URL.revokeObjectURL(pv.url));
        return currentPreviews;
      });
      if (outcome.status === "cancelled") return;
      if (outcome.status === "still_visible") {
        toast.error(t("privacyStillVisible"));
        return;
      }
      if (outcome.status === "person_photo") {
        toast.error(t("privacyPersonPhoto"));
        return;
      }
      if (outcome.status === "document_photo") {
        toast.error(t("privacyDocumentPhoto"));
        return;
      }
      if (outcome.autoCovered) toast.success(t("privacyAutoCovered"));
    }

    const hasNewImages = currentImages.length > 0;
    const textChanged =
      title !== item.title || description !== item.description;

    setSaving(true);
    try {
      const supabase = createClerkSupabaseClient(getToken);

      const finalImages = currentImages;
      // The database masks these numbers too.
      const finalTitle = maskSensitiveNumbers(title, category);
      const finalDescription = maskSensitiveNumbers(description, category);
      const finalCategory = category;

      // Any content change sends the listing back to an admin
      // (enforce_moderation_status puts it in 'pending').
      const contentChanged = hasNewImages || textChanged;

      const existingUrls = item.images?.map((img) => img.image_url) || [];
      const imagesChanged = noPhoto
        ? !(existingUrls.length === 1 && existingUrls[0] === placeholderImageUrl(finalCategory))
        : hasNewImages ||
          currentPreviews.length !== existingUrls.length ||
          currentPreviews.some((p, i) => p.isExisting && p.url !== existingUrls[i]);

      // 1. Upload new images to the Cloud (Storage)
      const finalImageUrls: string[] = [];
      // New uploads by public URL, for the visual-search vectors below.
      const uploadedFiles = new Map<string, Blob>();
      const newFiles = finalImages;
      let newFileIdx = 0;

      for (const preview of currentPreviews) {
        if (preview.isExisting) {
          finalImageUrls.push(preview.url);
        } else {
          // The privacy pipeline's safe file; the re-encode also drops all metadata.
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
          uploadedFiles.set(publicUrl, compressedFile);
        }
      }

      if (noPhoto) finalImageUrls.push(placeholderImageUrl(finalCategory));

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
        location_type: locationType,
        city,
      };

      const { error: updateError } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;

      // 3. Remove old images and save new images
      if (imagesChanged) {
        const thumbByUrl = new Map(
          (item.images ?? []).map((img) => [img.image_url, img.thumbnail_url ?? null]),
        );
        const removedUrls = existingUrls
          .filter((url) => !finalImageUrls.includes(url))
          .flatMap((url) => [url, thumbByUrl.get(url)])
          .filter((url): url is string => !!url);

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
          thumbnail_url: isPlaceholderUrl(url) ? url : thumbByUrl.get(url) ?? null,
        }));

        const { data: imageRows, error: imagesError } = await supabase
          .from("item_images")
          .insert(imageRecords)
          .select("id, image_url");
        if (imagesError)
          console.error("DATABASE ERROR (item_images):", imagesError.message);
        // Photos kept from before are re-read from their public URL. In the
        // background, on this device; never delays or fails the edit.
        else if (imageRows && !noPhoto) {
          void (async () => {
            for (const url of finalImageUrls) {
              if (uploadedFiles.has(url)) continue;
              try {
                const res = await fetch(url);
                if (res.ok) uploadedFiles.set(url, await res.blob());
              } catch {
                // the admin's review recomputes it anyway
              }
            }
            await attachEmbeddings(supabase, imageRows, uploadedFiles);
          })();
        }
      }

      toast.success(t("updateSuccess"));
      if (contentChanged) {
        // The listing is back in "pending", awaiting the admin — the profile
        // shows it as "under review" in "My Listings".
        router.push("/profile?tab=posts");
      } else {
        router.push(`/items/${id}`);
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2.5 sm:px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-7xl px-2.5 sm:px-4 py-8 max-w-2xl">
        <Card className="rounded-md overflow-hidden border border-slate-200 dark:border-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.08)] dark:shadow-none">
          {/* Form header */}
          <CardHeader className="bg-primary text-primary-foreground p-6">
            <CardTitle className="text-2xl min-[1084px]:text-3xl min-[1920px]:text-[32px] font-semibold tracking-tight">
              {t("editItemTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Listing type selection (Radio buttons) */}
              <div className="space-y-3">
                <Label className="text-sm min-[1084px]:text-base text-muted-foreground">
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
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-lost peer-data-[state=checked]:bg-lost-soft cursor-pointer transition-all"
                    >
                      <span className="text-2xl min-[1084px]:text-3xl mb-1">🔍</span>
                      <span className="font-semibold text-sm min-[1084px]:text-base">{t("lost")}</span>
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
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-found peer-data-[state=checked]:bg-white dark:peer-data-[state=checked]:bg-zinc-900 cursor-pointer transition-all"
                    >
                      <span className="text-2xl min-[1084px]:text-3xl mb-1">🎁</span>
                      <span className="font-semibold text-sm min-[1084px]:text-base">{t("found")}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Main data fields (Title, Category, Description) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-xs min-[1084px]:text-sm text-slate-500"
                  >
                    {t("titleLabel")}
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={item?.title}
                    placeholder={t("titleLabel")}
                    className="rounded-md h-11 min-[1084px]:h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="category"
                    className="text-xs min-[1084px]:text-sm text-slate-500"
                  >
                    {t("categoryLabel")}
                  </Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="h-11 min-[1084px]:h-12 rounded-md">
                      <SelectValue placeholder={t("categoryLabel")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
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
                  className="text-xs min-[1084px]:text-sm text-slate-500"
                >
                  {t("addItemLocationStep.title")}
                </Label>
                <Select
                  value={locationType ?? "none"}
                  onValueChange={(val) =>
                    setLocationType(
                      val === "none"
                        ? null
                        : (val as EditLocationType),
                    )
                  }
                >
                  <SelectTrigger className="h-11 min-[1084px]:h-12 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectItem value="none" className="rounded-md">
                      {t("addItemLocationStep.notSpecified")}
                    </SelectItem>
                    {EDIT_LOCATION_TYPES.map((loc) => (
                      <SelectItem key={loc} value={loc} className="rounded-md">
                        {t(`addItemLocationStep.${loc}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs min-[1084px]:text-sm text-slate-500">
                  {t("cityLabel")}
                </Label>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-1">
                  {CITY_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={city === id}
                      onClick={() => setCity(id)}
                      className={cn(
                        "shrink-0 h-9 px-3.5 rounded-md text-sm font-semibold cursor-pointer transition-colors",
                        city === id
                          ? "bg-primary text-primary-foreground"
                          : "bg-tile text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {cityLabel(id, locale)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs min-[1084px]:text-sm text-slate-500"
                >
                  {t("description")}
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={item?.description}
                  placeholder={t("description")}
                  className="rounded-md min-h-[100px] resize-none"
                  required
                />
                {isDocumentCategory(category) && (
                  <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-zinc-400">{t("docDescHint")}</p>
                )}
                {isNoPhotoCategory(category) && (
                  <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-zinc-400">{t("noPhotoNotice")}</p>
                )}
              </div>

              {/* Phone and Reward */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-xs min-[1084px]:text-sm text-slate-500"
                  >
                    {t("phoneLabel")}
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={item?.phone_number}
                    placeholder={t("phonePlaceholder")}
                    className="rounded-md h-11 min-[1084px]:h-12"
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
                    <span className="font-medium text-xs min-[1084px]:text-sm text-slate-500">
                      {t("contactViaTelegram")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Checkbox
                      checked={contactWhatsapp}
                      onCheckedChange={(checked) => setContactWhatsapp(checked === true)}
                    />
                    <WhatsappIcon size={18} />
                    <span className="font-medium text-xs min-[1084px]:text-sm text-slate-500">
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
                      <span className="font-medium text-xs min-[1084px]:text-sm text-action">
                        {t("reward_gives")}
                      </span>
                    </label>
                    {rewardEnabled && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="reward"
                          className="text-xs min-[1084px]:text-sm text-slate-500"
                        >
                          {t("reward_gives_input")}
                        </Label>
                        <Input
                          id="reward"
                          name="reward"
                          defaultValue={item?.reward?.replace(/[^0-9]/g, "")}
                          placeholder={t("rewardPlaceholder")}
                          className="rounded-md h-11 min-[1084px]:h-12"
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
                <Label className="text-xs min-[1084px]:text-sm text-slate-500">
                  {t("addImages")} ({previews.length}/5)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {previews.map((preview, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-md overflow-hidden border group"
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
                        className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 rounded-md shadow-lg transition-all z-20 border border-slate-100 dark:border-zinc-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {previews.length < 5 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-xs text-muted-foreground font-medium">
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
                {/* Documents, cards, faces on NEW photos: hidden by the user before saving. */}
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      // Covered by hand; the pipeline still re-checks it on save.
                      const result = await openPrivacyEditor(images, isDocumentCategory(category));
                      if (!result) return;
                      result.files.forEach((f, i) => markReviewed(f, result.covers[i] ?? []));
                      setImages(result.files);
                      setPreviews((prev) => {
                        let idx = 0;
                        return prev.map((p) => {
                          if (p.isExisting) return p;
                          URL.revokeObjectURL(p.url);
                          return { url: URL.createObjectURL(result.files[idx++]), isExisting: false };
                        });
                      });
                    }}
                    className="pressable w-full h-11 rounded-md border border-hairline dark:border-zinc-700 flex items-center justify-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    <EyeOff className="w-4 h-4" />
                    {t("hidePersonalInfo")}
                  </button>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 min-[1084px]:h-14 rounded-md text-base min-[1084px]:text-lg bg-primary hover:bg-primary/90 mt-4 text-primary-foreground"
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
          documentMode={privacyReview.documentMode}
          category={category}
          initialRegions={privacyReview.initialRegions}
          onConfirm={(finalFiles, covers) => {
            const resolve = privacyReview.resolve;
            setPrivacyReview(null);
            resolve({ files: finalFiles, covers });
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
