/**
 * This is the page for adding a new listing (Add Item Page).
 * Here we split the form into several steps, to make it easy and pleasant to use.
 */ "use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { CATEGORIES, UNSPECIFIED_REWARD } from "@/lib/services/item-service";
import { ProfileService } from "@/lib/services/profile-service";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
import { CITY_IDS, cityLabel } from "@/lib/cities";
import { TelegramIcon, WhatsappIcon } from "@/components/social-icons";
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
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  ImageOff,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { PhotoSourceSheet } from "@/components/photo-source-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PENDING_ADD_FILES_EVENT, takePendingAdd } from "@/lib/pending-add-files";
import { CategorySheet } from "@/components/category-sheet";
import { checkOwnerName, withOwnerLine } from "@/lib/document-owner";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ITEM_KEYS } from "@/lib/hooks/use-items";
import { isDocumentCategory, maskSensitiveNumbers } from "@/lib/sensitive-text";
import { attachEmbeddings } from "@/lib/visual-search";
import { isNoPhotoCategory, isPlaceholderUrl, placeholderImageUrl } from "@/lib/photo-policy";
import { isHiddenPhotoFile } from "@/lib/hidden-photo";

// These two components (the privacy blur canvas editor, the camera modal) are
// heavy and only needed in specific cases (a document was detected / the
// camera was opened) — next/dynamic splits them out of the main chunk of
// the "Add Listing" page.
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

  // Form states (Form States)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [contactTelegram, setContactTelegram] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState(false);

  // Listing data (Consolidated State for better stability)
  const [formData, setFormData] = useState({
    type: null as "lost" | "found" | null,
    title: "",
    category: "",
    description: "",
    phone: "",
    reward: "",
    locationType:
      null as
        | "taxi" | "hotel_restaurant" | "public_place" | "airport" | "gym"
        | "university" | "mall" | "office" | "tourism" | "bank"
        | null,
  });
  // Step 6 ("where?") requires a selection to proceed — but "Other" is also
  // a valid choice (locationType still stays null). This flag is only needed
  // to distinguish "hasn't chosen yet" from "chose Other", so the
  // RadioGroup doesn't render empty from the start.
  const [locationAnswered, setLocationAnswered] = useState(false);
  // City of the listing — no default, the user must choose it (step 6 blocks until then).
  const [city, setCity] = useState<string | null>(null);

  // Found listings: the finder always keeps the item (the old "hand it to a
  // nearby shop" option was removed by product decision). Picking "found"
  // first asks whether they can tell who the owner is; if not, they are
  // advised to take it to the police instead of posting it.
  const [foundAskOpen, setFoundAskOpen] = useState(false);
  const [policeAdviceOpen, setPoliceAdviceOpen] = useState(false);

  // The actual navigation order of the steps — step 3 (publishing) comes
  // last, not third; step 6 ("where?") is placed after the details step.
  // The category is chosen first (navbar "+" → CategorySheet); Documents/Cards have no photo step.
  const stepOrder = isNoPhotoCategory(formData.category) ? [2, 6, 4, 5, 3] : [1, 2, 6, 4, 5, 3];
  const firstStep = stepOrder[0];
  const stepIndex = stepOrder.indexOf(step);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // "Ман сурат надорам" — lets the user skip photos entirely. A category
  // icon stands in for the image on the feed card, and search falls back
  // to title/description only.
  const [noPhotoAdviceOpen, setNoPhotoAdviceOpen] = useState(false);

  // The privacy editor — opened by the person from the photo step to cover
  // numbers, names or faces by hand (or hide a photo completely).
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    resolve: (files: File[] | null) => void;
  } | null>(null);

  const openPrivacyEditor = (files: File[]) =>
    new Promise<File[] | null>((resolve) => {
      setPrivacyReview({ files, resolve });
    });

  const replaceImages = (files: File[]) => {
    setImages(files);
    setPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      // A photo hidden completely in the editor shows the document image.
      return files.map((f) => (isHiddenPhotoFile(f) ? placeholderImageUrl("Documents") : URL.createObjectURL(f)));
    });
  };

  // One button under the photos opens the editor with every photo.
  const reviewPhotos = async () => {
    const files = await openPrivacyEditor(images);
    if (files) replaceImages(files);
  };

  // The safety notice is shown AFTER the blur step (if it's a document), but
  // BEFORE the actual publish — publishing only starts after "Got it".
  const [safetyAck, setSafetyAck] = useState<{ resolve: (proceed: boolean) => void } | null>(null);
  const [postSuccessRedirect, setPostSuccessRedirect] = useState("/profile?tab=posts");
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  // Documents: the owner's first name + first letter of the surname (lib/document-owner.ts).
  const [ownerName, setOwnerName] = useState("");
  const [moderationStatus, setModerationStatus] = useState<"idle" | "passed">("idle");

  // Load the phone number from the profile
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

    setModerationStatus("idle");
  };


  useEffect(() => {
    const consume = (initial: boolean) => {
      const pending = takePendingAdd();
      if (!pending) {
        // Opened straight at /items/add (not from the navbar "+"): ask for the category first.
        if (initial) setCatSheetOpen(true);
        return;
      }
      const files = pending.files;
      setFormData((prev) => ({ ...prev, category: pending.category }));
      setImages(files);
      setPreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return files.map((file) => URL.createObjectURL(file));
      });
      setStep(isNoPhotoCategory(pending.category) ? 2 : 1);
      setModerationStatus("idle");
    };
    consume(true);
    const onPending = () => consume(false);
    window.addEventListener(PENDING_ADD_FILES_EVENT, onPending);
    return () => window.removeEventListener(PENDING_ADD_FILES_EVENT, onPending);
  }, []);

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

    setModerationStatus("idle");
  };

  // Validate steps before moving forward
  const nextStep = () => {
    if (step === 1) {
      if (images.length === 0) {
        toast.error(t("pickImage"));
        return;
      }
      setStep(2); // Move to the type-selection step
    } else if (step === 2) {
      if (!formData.type) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(6); // "Where?" comes right after the type — this continues the same question
    } else if (step === 4) {
      if (
        !formData.title.trim() ||
        !formData.category ||
        !formData.description.trim()
      ) {
        toast.error(t("fillAllFields"));
        return;
      }
      // Switched from Documents/Cards to a category that needs photos.
      if (!isNoPhotoCategory(formData.category) && images.length === 0) {
        toast.error(t("pickImage"));
        setStep(1);
        return;
      }
      if (isNoPhotoCategory(formData.category)) {
        const owner = checkOwnerName(ownerName);
        if (owner && !owner.ok) {
          toast.error(t(owner.reason === "full_surname" ? "docOwnerFullSurname" : "docOwnerFormat"));
          return;
        }
      }
      continueFromDetails();
    } else if (step === 6) {
      if (!city || !locationAnswered) {
        toast.error(t("fillAllFields"));
        return;
      }
      setStep(4); // Location → details
    } else if (step === 5) {
      if (!formData.phone.trim()) {
        toast.error(t("fillAllFields"));
        return;
      }
      onFinalSubmit();
    }
  };

  const continueFromDetails = () => {
    setStep(5); // Details → contact
  };

  const prevStep = () => {
    // User request: a "Back" button is needed on step 1 too — previously
    // there was no button there at all (see the `step > 1` condition in the
    // footer below), so the user had no way to exit the wizard.
    if (step === firstStep) {
      router.push("/");
      return;
    }
    if (step === 4) {
      setStep(6);
      setModerationStatus("idle");
    } else if (step === 6) {
      setStep(2);
    } else if (step === 5) {
      setStep(4);
    } else if (step > 1 && step !== 3) {
      setStep(step - 1);
      // Reset moderation if going back to edit photos or type
      setModerationStatus("idle");
    }
  };

  const onFinalSubmit = async () => {
    setLoading(true);
    // Documents/Cards: no photo leaves the browser; the listing gets the JUYO image.
    const finalImages: File[] = isNoPhotoCategory(formData.category) ? [] : images;
    // The database masks these numbers too; doing it here keeps what the
    // poster sees in sync with what is saved.
    const finalTitle = maskSensitiveNumbers(formData.title, formData.category);
    const owner = isNoPhotoCategory(formData.category) ? checkOwnerName(ownerName) : null;
    const finalDescription = withOwnerLine(
      maskSensitiveNumbers(formData.description, formData.category),
      owner?.ok ? owner.value : null,
      locale,
    );
    const finalCategory = formData.category;

    // We start the notification permission prompt right here (not after
    // upload/insert) — so the browser recognizes it as a direct continuation
    // of the user's click (some browsers reject the permission prompt after
    // a few awaits). It's fire-and-forget, it doesn't block publishing the
    // listing. We show a short note before the prompt, so the user
    // understands what it's for (this was the one "silent" spot that opened
    // the notification permission without any explanation).
    if (pushStatus === "default") {
      toast.info(t("pushPromptOnPublish"));
      subscribeToPush().catch(() => {});
    }

    setStep(3);

    // 1.6 We show the safety notice right before publishing — publishing
    // only starts after "Got it".
    setModerationStatus("idle");
    const proceed = await new Promise<boolean>((resolve) => {
      setSafetyAck({ resolve });
    });
    if (!proceed) {
      setStep(4);
      setLoading(false);
      return;
    }

    // 2. PUBLISHING THE LISTING — the listing is saved as written and waits
    // for an admin (moderation_status 'pending', migration
    // 20261001000000_remove_ai). We show the success screen immediately — uploading the
    // images and the actual database write continue in the background, so
    // the user doesn't have to wait. If an error occurs in the background, a
    // toast warning appears (the screen doesn't revert to a "failed" state,
    // since the user has already seen "success").
    setPostSuccessRedirect("/profile?tab=posts");
    setModerationStatus("passed");

    const announcePublished = () => {
      queryClient.invalidateQueries({ queryKey: ITEM_KEYS.user() });
      window.dispatchEvent(new Event("items-updated"));
    };

    const publishWork = async () => {
      const supabase = createClerkSupabaseClient(getToken);

      const imageUrls: string[] = [];
      // Uploaded bytes by public URL: the visual-search vector is made from
      // exactly the file that was published.
      const uploadedFiles = new Map<string, Blob>();
      // finalImages are the privacy pipeline's safe files; the re-encode
      // below also drops all metadata (EXIF/GPS).
      for (const file of finalImages) {
        // Hidden completely in the editor: never uploaded, the document image instead.
        if (isHiddenPhotoFile(file)) {
          imageUrls.push(placeholderImageUrl("Documents"));
          continue;
        }
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
        uploadedFiles.set(publicUrl, compressedFile);
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
        handoff_type: formData.type === "found" ? "self" : null,
        handoff_phone: null,
        handoff_photo_url: null,
        reward:
          formData.type === "lost"
            ? rewardEnabled
              ? UNSPECIFIED_REWARD
              : formData.reward || null
            : null,
        date: new Date().toISOString().split("T")[0],
        is_resolved: false,
        moderation_status: "pending",
        location_type: formData.locationType,
        city,
      };

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert([itemData])
        .select()
        .single();
      if (itemError) throw itemError;

      if (isNoPhotoCategory(finalCategory)) {
        const placeholder = placeholderImageUrl(finalCategory);
        await supabase.from("item_images").insert({ item_id: item.id, image_url: placeholder, thumbnail_url: placeholder });
      }

      // A photo-less listing — no images to wait for.
      if (imageUrls.length === 0) announcePublished();

      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map((url) => ({
          item_id: item.id,
          image_url: url,
        }));

        const { data: imageRows, error: imagesError } = await supabase
          .from("item_images")
          .insert(imageRecords)
          .select("id, image_url");

        announcePublished();

        if (imagesError) {
          console.error("DATABASE ERROR:", imagesError.message);
        } else if (imageRows) {
          // In the background, on this device; never delays or fails the listing.
          void attachEmbeddings(supabase, imageRows.filter((row) => !isPlaceholderUrl(row.image_url)), uploadedFiles);
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

  // CORNER RADIUS — site-wide normalization: every non-circular container
  // on this page (checkbox, input, icon, button, card, dialog) uses a single
  // `rounded-md` (10px, matches the home-page filters/images/search input
  // standard) instead of the tiered per-size scale this page used to have.
  //   rounded-md   10px   everything except pills/circles
  //   rounded-full        pill shapes and circles
  return (
    <div className="mx-auto w-full max-w-7xl px-0 sm:px-0 py-0 sm:py-0 h-[calc(100dvh-128px)] sm:h-[calc(100dvh-64px)] flex flex-col">
      <Card className="flex-1 rounded-none overflow-hidden border-none shadow-none flex flex-col bg-canvas">
        {/* Step Indicator */}
        {/* The actual navigation order of the steps is NOT 1→2→3→4→5 — step
            3 (publishing) is last, shown only when publishing (onFinalSubmit):
            1 → 2 → 4 → 5 → 3. A simple numeric comparison step > i+1 was
            wrong — once step=3, steps 4 and 5 (which had already passed)
            were incorrectly shown as empty (gray). */}
        <div className="w-full flex h-1.5 gap-1 bg-white dark:bg-transparent overflow-hidden shrink-0">
          {stepOrder.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-full flex-1 transition-all duration-700 ease-in-out",
                stepIndex > i
                  ? "bg-action"
                  : stepIndex === i
                    ? "bg-action/60"
                    : "bg-slate-100 dark:bg-zinc-700",
              )}
            />
          ))}
        </div>

        <CardContent className="p-2 sm:p-4 md:p-6 lg:p-8 flex-1 flex flex-col justify-start pt-10 sm:pt-6 overflow-y-auto scrollbar-none">
          {/* Step 1: Photos First (Refined) */}
          {step === 1 && (
            <div className="space-y-6 w-full pt-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
                {images.length < 4 && (
                  <div
                    onClick={() => setShowPhotoChoice(true)}
                    className="aspect-square flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 cursor-pointer hover:border-action/60 transition-all group order-first"
                  >
                    <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 rounded-full bg-canvas dark:bg-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <Plus className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6" strokeWidth={3} />
                    </div>
                  </div>
                )}
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-md overflow-hidden group bg-white dark:bg-zinc-800"
                  >
                    {/* Whole photo, not zoomed in; the free space is the same photo blurred (like the listing page). */}
                    <Image src={src} alt="" aria-hidden fill className="object-cover scale-110 blur-2xl" />
                    <Image
                      src={src}
                      alt="Preview"
                      fill
                      className="object-contain"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 min-[1084px]:p-2 rounded-md transition-all z-20"
                    >
                      <X className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 min-[1920px]:w-4 min-[1920px]:h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* One button (not one per photo): numbers and other personal details are covered by hand. */}
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => void reviewPhotos()}
                  className="pressable mx-auto flex h-11 items-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-600 px-4 text-sm font-semibold text-white"
                >
                  <EyeOff className="h-4 w-4" />
                  {t("hideDataBtn")}
                </button>
              )}

              {/* Hidden Inputs */}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                ref={galleryInputRef}
                onChange={handleImageChange}
              />

              <PhotoSourceSheet
                open={showPhotoChoice}
                onOpenChange={setShowPhotoChoice}
                onCamera={() => setShowCameraCapture(true)}
                onGallery={() => galleryInputRef.current?.click()}
                onNoPhoto={() => setNoPhotoAdviceOpen(true)}
              />
              <ConfirmDialog
                open={noPhotoAdviceOpen}
                onOpenChange={setNoPhotoAdviceOpen}
                icon={ImageOff}
                title={t("addNoPhotoTitle")}
                description={t("addNoPhotoDesc")}
                confirmLabel={t("addNoPhotoConfirm")}
                cancelLabel={t("cancel")}
                onConfirm={() => {
                  setNoPhotoAdviceOpen(false);
                  galleryInputRef.current?.click();
                }}
              />

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
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-action">
                  {t("what_happened")}
                </h2>
              </div>
              <RadioGroup
                value={formData.type || ""}
                onValueChange={(val) => {
                  if (val === "found" && formData.type !== "found") {
                    setFoundAskOpen(true);
                    return;
                  }
                  setFormData((prev) => ({ ...prev, type: val as "lost" | "found" }));
                }}
                className="grid grid-cols-1 gap-3"
              >
                <div className="relative">
                  <Label
                    htmlFor="lost"
                    className="flex items-center gap-3 rounded-md bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-action cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🔍
                    </div>
                    <div className="flex-1">
                      <span className="block font-semibold text-base min-[1084px]:text-lg leading-snug text-lost">
                        {t("lost")}
                      </span>
                      <span className="text-muted-foreground text-[13px] min-[1084px]:text-sm font-medium">
                        {t("lost_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="lost"
                      id="lost"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-slate-200 dark:border-zinc-600 data-[state=checked]:border-action data-[state=checked]:bg-action [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-3 rounded-md bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-action cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🎁
                    </div>
                    <div className="flex-1">
                      <span className="block font-semibold text-base min-[1084px]:text-lg leading-snug text-found">
                        {t("found")}
                      </span>
                      <span className="text-muted-foreground text-[13px] min-[1084px]:text-sm font-medium">
                        {t("found_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="found"
                      id="found"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-slate-200 dark:border-zinc-600 data-[state=checked]:border-action data-[state=checked]:bg-action [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 6: Location of loss/finding (optional) */}
          {step === 6 && (
            <div className="space-y-6 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-action">
                  {formData.type === "lost"
                    ? t("addItemLocationStep.titleLost")
                    : formData.type === "found"
                      ? t("addItemLocationStep.titleFound")
                      : t("addItemLocationStep.title")}
                </h2>
              </div>
              {/* City first (like the app) — swipe sideways; nothing is preselected. */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("cityLabel")}</p>
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

              {/* Places as a 2-column grid of tiles — label left, emoji right —
                  exactly like the app's placeGrid/placeTile. */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "taxi", emoji: "🚕" },
                    { value: "airport", emoji: "✈️" },
                    { value: "hotel_restaurant", emoji: "🏨" },
                    { value: "public_place", emoji: "🎭" },
                    { value: "gym", emoji: "🏋️" },
                    { value: "university", emoji: "🎓" },
                    { value: "mall", emoji: "🛍️" },
                    { value: "office", emoji: "🏢" },
                    { value: "tourism", emoji: "🧳" },
                    { value: "bank", emoji: "🏦" },
                    { value: "none", emoji: "🤷" },
                  ] as const
                ).map((opt) => {
                  const on = locationAnswered && (formData.locationType || "none") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setLocationAnswered(true);
                        setFormData((prev) => ({
                          ...prev,
                          locationType: opt.value === "none" ? null : opt.value,
                        }));
                      }}
                      className={cn(
                        "flex items-center justify-between gap-1.5 rounded-[10px] px-2.5 py-3 text-left transition-colors",
                        on ? "bg-emerald-500 text-white" : "bg-tile text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700",
                      )}
                    >
                      <span className="min-w-0 line-clamp-2 text-[13px] font-semibold leading-snug">
                        {opt.value === "none"
                          ? t("addItemLocationStep.notSpecified")
                          : t(`addItemLocationStep.${opt.value}`)}
                      </span>
                      <span aria-hidden className="shrink-0 text-[26px] leading-none">{opt.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: publishing / sent for review */}
          {step === 3 && (
            <div className="space-y-6 text-center max-w-5xl mx-auto w-full py-2 flex-1 flex flex-col justify-start pt-4 sm:pt-6">
              {/* Sent for review — shown while the upload finishes in the background. */}
              {moderationStatus === "passed" && (
                <div className="space-y-6 max-w-sm mx-auto w-full">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-action" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-action">
                      {t("success")}
                    </h2>
                    <p className="text-slate-500 dark:text-zinc-400 font-semibold text-sm tracking-tight">
                      {t("imageModeration.submitted")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(postSuccessRedirect)}
                    className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-md font-medium text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {t("done")}
                  </Button>
                </div>
              )}

              {/* Idle — waiting for the safety notice to be confirmed. */}
              {moderationStatus === "idle" && (
                <div className="space-y-4">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <Loader2 className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-action animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details (Auto-filled) */}
          {step === 4 && (
            <div className="space-y-5 max-w-lg mx-auto w-full">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-muted-foreground ml-1">
                  {t("titleLabel")}
                </Label>
                <Input
                  placeholder={t("titleLabel")}
                  // placeholder:font-medium — the title itself stays bold,
                  // but the placeholder matches the same weight as the
                  // description's placeholder, otherwise the boldness makes
                  // it look too prominent.
                  className="rounded-md h-11 min-[1084px]:h-12 bg-white dark:bg-zinc-800 border-none text-sm min-[1084px]:text-base placeholder:font-medium shadow-none"
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
                <Label className="text-sm font-semibold text-muted-foreground ml-1">
                  {t("categoryLabel")}
                </Label>
                {/* The category is chosen first (CategorySheet, before photos); here it can still be changed. */}
                {(() => {
                  const current = CATEGORIES.find((c) => c.name === formData.category);
                  return (
                    <button
                      type="button"
                      onClick={() => setCatSheetOpen(true)}
                      className="pressable flex w-full items-center gap-3 rounded-md bg-white px-3 py-2.5 text-left dark:bg-zinc-800"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-canvas text-lg" aria-hidden>
                        {current?.icon ?? "＋"}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {current ? t(`categories.${current.id}`) : t("addChooseCategory")}
                      </span>
                      <span className="text-sm font-semibold text-action">{t("addChangeCategory")}</span>
                    </button>
                  );
                })()}
              </div>

              {isNoPhotoCategory(formData.category) && (
                <div className="space-y-1.5">
                  <Label htmlFor="doc-owner" className="text-sm font-semibold text-muted-foreground ml-1">
                    {t(formData.category === "Cards" ? "cardOwnerLabel" : "docOwnerLabel")}
                  </Label>
                  <Input
                    id="doc-owner"
                    placeholder={t("docOwnerPlaceholder")}
                    autoComplete="off"
                    maxLength={40}
                    className="rounded-md h-12 bg-white dark:bg-zinc-800 border-none text-sm min-[1084px]:text-base font-medium shadow-none"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-muted-foreground ml-1">
                  {t("description")}
                </Label>
                <Textarea
                  placeholder={t("descPlaceholderManual")}
                  className="rounded-md min-h-[88px] min-[1084px]:min-h-[104px] bg-white dark:bg-zinc-800 border-none text-sm min-[1084px]:text-base font-medium shadow-none resize-none"
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
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-action">
                  {t("contactInfo") || "Contact Information"}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground ml-1">
                    {t("phoneLabel")}
                  </Label>
                  <PhoneInput
                    containerClassName="h-13 min-[1084px]:h-14 bg-white dark:bg-zinc-800"
                    className="text-base min-[1084px]:text-lg text-action"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>


                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-md bg-white dark:bg-transparent px-4 py-3">
                    <Checkbox
                      checked={contactTelegram}
                      className="w-5 h-5 rounded-md border-slate-200 dark:border-zinc-600 shrink-0"
                      onCheckedChange={(checked) => setContactTelegram(checked === true)}
                    />
                    <TelegramIcon size={20} />
                    <span className="text-xs min-[1084px]:text-sm font-medium text-slate-500">
                      {t("contactViaTelegram")}
                    </span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-md bg-white dark:bg-transparent px-4 py-3">
                    <Checkbox
                      checked={contactWhatsapp}
                      className="w-5 h-5 rounded-md border-slate-200 dark:border-zinc-600 shrink-0"
                      onCheckedChange={(checked) => setContactWhatsapp(checked === true)}
                    />
                    <WhatsappIcon size={20} />
                    <span className="text-xs min-[1084px]:text-sm font-medium text-slate-500">
                      {t("contactViaWhatsapp")}
                    </span>
                  </label>
                </div>
                {formData.type === "lost" && (
                  <div className="space-y-3">
                    {/* Once an amount is typed the "gift" checkbox disappears;
                        it comes back when the field is emptied. */}
                    {!formData.reward && (
                      <label className="flex items-center gap-3 cursor-pointer select-none rounded-md bg-white dark:bg-transparent px-4 py-3">
                        <Checkbox
                          checked={rewardEnabled}
                          className="w-5 h-5 rounded-md border-slate-200 dark:border-zinc-600 shrink-0"
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setRewardEnabled(isChecked);
                            if (isChecked) {
                              setFormData((prev) => ({ ...prev, reward: "" }));
                            }
                          }}
                        />
                        <span className="text-sm min-[1084px]:text-base font-semibold text-action">
                          {t("reward_gives")}
                        </span>
                      </label>
                    )}
                    {!rewardEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-muted-foreground ml-1">
                          {t("reward_gives_input")}
                        </Label>
                        <div className="relative">
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 font-semibold text-sm min-[1084px]:text-base text-muted-foreground">
                            TJS
                          </span>
                          <Input
                            placeholder={t("reward_gives_input")}
                            className="rounded-md h-13 min-[1084px]:h-14 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-none text-base min-[1084px]:text-lg text-action pr-14 pl-5 transition-all"
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
            {step !== 3 && (
              <Button
                variant="outline"
                size="lg"
                onClick={prevStep}
                className="flex-1 rounded-md h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] border-none shadow-none bg-white dark:bg-zinc-800 font-medium tracking-normal text-sm min-[1084px]:text-base text-slate-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
              >
                <ArrowLeft className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5 mr-2" />
                {t("back")}
              </Button>
            )}
            {(step === 1 || step === 2 || step === 6 || step === 4) && (
              <Button
                size="lg"
                onClick={nextStep}
                className="flex-1 rounded-md h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] text-sm min-[1920px]:text-[15px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
              >
                {t("next")}
              </Button>
            )}
            {step === 5 && (
              <Button
                onClick={nextStep}
                disabled={loading}
                className="flex-1 rounded-md h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] text-sm min-[1920px]:text-[15px] font-semibold transition-all bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-none"
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

      {/* "Found": can the finder tell who the owner is? Two tappable
          choice cards so it reads as a question, not an info popup. */}
      <CategorySheet
        open={catSheetOpen}
        selected={formData.category}
        onOpenChange={(open) => {
          setCatSheetOpen(open);
          // Opened straight at /items/add and closed without a choice: nothing to add.
          if (!open && !formData.category) router.push("/");
        }}
        onPick={(category) => {
          setCatSheetOpen(false);
          setFormData((prev) => ({ ...prev, category }));
          if (step === 1 && isNoPhotoCategory(category)) setStep(2);
          else if (step === 1 && images.length === 0) setTimeout(() => setShowPhotoChoice(true), 300);
        }}
      />

      <Dialog open={foundAskOpen} onOpenChange={setFoundAskOpen}>
        <DialogContent className="max-w-[360px] rounded-md p-5 pt-8 border-none shadow-2xl gap-0">
          <DialogHeader className="mb-4 space-y-1">
            <DialogTitle className="text-lg font-bold tracking-tight text-center text-zinc-900 dark:text-zinc-100">
              {t("foundAskTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            {(
              [
                { key: "unknown", emoji: "🤷", label: "foundAskUnknownOwner", hint: "foundAskUnknownOwnerHint" },
                { key: "known", emoji: "🙋", label: "foundAskKnownOwner", hint: "foundAskKnownOwnerHint" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setFoundAskOpen(false);
                  if (opt.key === "known") {
                    setFormData((prev) => ({ ...prev, type: "found" }));
                    // "Yes" is a full answer to step 2 — go straight to the next step.
                    setStep(6);
                  } else {
                    setPoliceAdviceOpen(true);
                  }
                }}
                className="w-full flex items-center gap-3 rounded-lg border-[1.5px] border-action bg-found-soft px-3.5 py-3.5 text-left cursor-pointer hover:bg-found-soft/70 transition-colors"
              >
                <span className="text-3xl shrink-0">{opt.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{t(opt.label)}</span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">{t(opt.hint)}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-action shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={policeAdviceOpen} onOpenChange={setPoliceAdviceOpen}>
        <DialogContent className="max-w-[360px] rounded-md p-5 pt-8 border-none shadow-2xl gap-0 text-center">
          <div className="text-5xl mb-2">👮</div>
          <DialogHeader className="mb-3">
            <DialogTitle className="text-lg font-bold tracking-tight text-center text-zinc-900 dark:text-zinc-100">
              {t("policeAdviceTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">{t("policeAdviceDesc")}</p>
          <Button
            type="button"
            onClick={() => setPoliceAdviceOpen(false)}
            className="w-full h-12 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {t("policeAdviceOk")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Safety Advice Modal — after the blur step (if it's a document), before the actual publish */}
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
        <DialogContent className="sm:max-w-md rounded-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-7 space-y-5 text-center">
            <div className="w-16 h-16 min-[1084px]:w-20 min-[1084px]:h-20 min-[1920px]:w-24 min-[1920px]:h-24 rounded-md flex items-center justify-center mx-auto bg-red-50 dark:bg-red-900/20">
              <ShieldAlert className="w-8 h-8 min-[1084px]:w-10 min-[1084px]:h-10 min-[1920px]:w-11 min-[1920px]:h-11 text-red-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg min-[1084px]:text-xl min-[1920px]:text-2xl tracking-tight leading-snug">
                {formData.type === "found"
                  ? t("safetyPostModal.foundTitle")
                  : t("safetyPostModal.lostTitle")}
              </DialogTitle>
              <p className="text-slate-500 font-medium text-[13px] min-[1084px]:text-sm min-[1920px]:text-base leading-relaxed">
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
              className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-md font-medium text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] text-primary-foreground bg-primary hover:bg-primary/90"
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
