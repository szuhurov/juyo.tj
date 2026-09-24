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
import {
  createClerkSupabaseClient,
  supabase as anonSupabase,
} from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
import { CITY_IDS, cityLabel } from "@/lib/cities";
import {
  OrganizationItemService,
  type CompatibleOrganization,
  type OrganizationBranchOption,
} from "@/lib/services/organization-item-service";
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
  ChevronRight,
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
        | "university" | "mall" | "office" | "event" | "tourism" | "bank"
        | null,
  });
  // Phase 7 — optional organization association. Attaching one sends the
  // post for organization review (server-authoritative; see
  // supabase/migrations/20260929000000_organization_item_routing.sql) —
  // it never changes personal ownership of the post.
  const [compatibleOrgs, setCompatibleOrgs] = useState<CompatibleOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgBranches, setOrgBranches] = useState<OrganizationBranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
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

  // The actual navigation order of the steps — step 3 (AI check) comes
  // last, not third; step 6 ("where?") is placed after the details step.
  const stepOrder = [1, 2, 6, 4, 5, 3];
  const stepIndex = stepOrder.indexOf(step);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // "Ман сурат надорам" — lets the user skip photos entirely. A category
  // icon stands in for the image on the feed card, and search falls back
  // to title/description only (no visual-search vector to build).
  const [noPhoto, setNoPhoto] = useState(false);

  // Privacy protection editor — not a separate AI call, it uses the same
  // result from the already-run final_check (is_document + privacy_regions).
  // If it's a document, after moderation is confirmed, this dialog opens for
  // each image in turn — with the regions AI suggested, which the user can
  // edit/add to with the pen tool.
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    regions: PrivacyRegion[];
    resolve: (result: File[] | null) => void;
  } | null>(null);

  // The safety notice is shown AFTER the blur step (if it's a document), but
  // BEFORE the actual publish — publishing only starts after "Got it".
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
  // Defaults to true (until settings load) — if the admin has turned off AI
  // moderation from the dashboard (e.g. the OpenAI token ran out), listings
  // are published without an AI check, with moderation_status='pending'.
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

  // Phase 7 — refetch compatible organizations whenever the place type or
  // city changes; drop the current selection if it's no longer in the
  // (re)fetched list rather than silently keeping a stale org attached.
  useEffect(() => {
    if (!formData.locationType) {
      setCompatibleOrgs([]);
      setSelectedOrgId(null);
      return;
    }
    let cancelled = false;
    setLoadingOrgs(true);
    OrganizationItemService.getCompatibleOrganizations(formData.locationType, city ?? undefined, anonSupabase)
      .then((orgs) => {
        if (cancelled) return;
        setCompatibleOrgs(orgs);
        setSelectedOrgId((prev) => (prev && orgs.some((o) => o.id === prev) ? prev : null));
      })
      .catch(() => {
        if (!cancelled) setCompatibleOrgs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrgs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.locationType, city]);

  // Refetch branches when the selected organization changes.
  useEffect(() => {
    if (!selectedOrgId) {
      setOrgBranches([]);
      setSelectedBranchId(null);
      return;
    }
    let cancelled = false;
    OrganizationItemService.getOrganizationBranchesForPicker(selectedOrgId, city ?? undefined, anonSupabase)
      .then((branches) => {
        if (cancelled) return;
        setOrgBranches(branches);
        setSelectedBranchId(branches.length === 1 ? branches[0].id : null);
      })
      .catch(() => {
        if (!cancelled) setOrgBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, city]);

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
    setNoPhoto(false);

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

  // Validate steps before moving forward
  const nextStep = () => {
    if (step === 1) {
      if (images.length === 0 && !noPhoto) {
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
      setStep(5); // Details → contact
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

  const prevStep = () => {
    // User request: a "Back" button is needed on step 1 too — previously
    // there was no button there at all (see the `step > 1` condition in the
    // footer below), so the user had no way to exit the wizard.
    if (step === 1) {
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
    let finalImages: File[] = images;
    let finalTitle = formData.title;
    let finalDescription = formData.description;
    let finalCategory = formData.category;
    let finalModerationStatus: "approved" | "pending" = "approved";
    let finalModerationResult: string | null = "Approved by AI Brain";

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

    if (aiModerationEnabled && images.length > 0) {
      // 1. SINGLE SAFETY CHECK — image (final) + text (final) together, once,
      // right here, before publishing. This is the only AI moderation point
      // in the entire add-listing flow (mode=suggest in step 3 never
      // rejects — it only provides a description).
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

        // ai-brain is now called through the server's own route (not
        // directly from the browser to Supabase) — see app/api/items/moderate.
        const checkRes = await fetch("/api/items/moderate", {
          method: "POST",
          body: finalCheckData,
        });
        const checkData = await checkRes.json().catch(() => null);
        const checkError = !checkRes.ok
          ? new Error(checkData?.error || "Санҷиши AI ноком шуд")
          : null;

        if (checkError || (checkData && checkData.is_safe === false)) {
          // BUG FOUND: a technical failure inside ai-brain (OpenAI rate-limit,
          // malformed model JSON, etc.) used to look identical to a genuine
          // content rejection — the user saw "your content violates the
          // rules" for something that had nothing to do with their content.
          // `technical_error` (see supabase/functions/ai-brain) tells them
          // to just retry instead.
          const isTechnical = !checkError && checkData?.technical_error === true;
          setModerationStatus("failed");
          setModerationError(
            isTechnical
              ? t("ai_steps.technical_error") ||
                  "Санҷиши AI муваққатан кор накард. Лутфан аз нав кӯшиш кунед."
              : checkData?.reason ||
                  checkError?.message ||
                  t("ai_steps.text_moderation_failed") ||
                  "Эълони шумо ба қоидаҳо мувофиқат намекунад.",
          );
          setModerationViolationSource(checkData?.violation_source ?? null);
          setLoading(false);
          return;
        }

        // 1.4 TEXT CLEANUP — fulfills the placeholder's promise "AI will fix
        // it". The user can write quickly and with typos; AI turns it into a
        // readable description and shortens the title to a few words.
        //
        // This is NOT a separate call — the same final_check above returns
        // both results together (like privacy_regions), so no new delay is
        // introduced.
        finalTitle = checkData?.polished_title || formData.title;
        finalDescription = checkData?.polished_description || formData.description;

        // 1.5 This is the result of the same check above (is_document +
        // privacy_regions) — not a new AI call. If it's a document, before
        // uploading, the user sees the regions AI suggested and can edit/add
        // to them with the pen tool before confirming. The "success" screen
        // is only shown AFTER all the blurring is done — not before.
        if (checkData?.is_document) {
          // The document/passport number is stripped from the text, the
          // name/surname stays unchanged. The prompt asks AI to already
          // return polished_* without the number — `stripDocumentNumbers` is
          // just a safety net in case the model lets it slip through. An
          // error here is high-stakes: a real person's passport number gets
          // exposed.
          finalTitle = stripDocumentNumbers(finalTitle);
          finalDescription = stripDocumentNumbers(finalDescription);
          // The category is forced to "Documents", regardless of which
          // category the user had selected.
          finalCategory = "Documents";

          setModerationStatus("idle");
          const suggestedRegions: PrivacyRegion[] = checkData.privacy_regions ?? [];
          const blurred = await new Promise<File[] | null>((resolve) => {
            setPrivacyReview({ files: images, regions: suggestedRegions, resolve });
          });
          if (!blurred) {
            // The user exited the blur dialog — we stop publishing, so a
            // document without blurring is never published.
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
      // Two cases land here: (a) AI moderation turned off from the admin
      // dashboard (e.g. the OpenAI token ran out), or (b) no photo was
      // attached — ai-brain requires at least one image ("No images
      // provided"), so the synchronous check can't run for this listing.
      // Either way, the listing publishes with "pending": it's only visible
      // in the user's own profile (the search_items RPC filters it that
      // way) until the async `image-moderation` trigger (which does a
      // text-only OpenAI check when an item has no images — see
      // supabase/functions/image-moderation) sets the final status.
      finalModerationStatus = "pending";
      // NOTE: moderation_result is visible to the user on the listing page
      // (see item-details-client.tsx). So no reason is written here — the
      // user shouldn't know that AI is off; for them it's just the normal
      // "under review" state.
      finalModerationResult = null;
    }

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

    // 2. PUBLISHING THE LISTING — the AI check and user confirmations are
    // already done. We show the success screen immediately — uploading the
    // images and the actual database write continue in the background, so
    // the user doesn't have to wait. If an error occurs in the background, a
    // toast warning appears (the screen doesn't revert to a "failed" state,
    // since the user has already seen "success").
    setPostSuccessRedirect("/profile?tab=posts");
    setModerationStatus("passed");

    // "Done" isn't awaited — the user may already be on the profile page by
    // the time the write finishes. So we need both the event (if the list is
    // open) and sessionStorage (if it's opened later).
    //
    // `startedAt` is captured NOW, not after saving: uploading the images
    // takes 3-5 seconds, and without this counter the card's timer would
    // restart from 10 even though the check had already begun.
    const startedAt = Date.now();
    const announce = (id?: string) => {
      const state: JustPublishedState = { id, startedAt };
      try {
        sessionStorage.setItem(JUST_PUBLISHED_KEY, JSON.stringify(state));
      } catch {
        // Safari private mode — the event alone is enough.
      }
      window.dispatchEvent(
        new CustomEvent(JUST_PUBLISHED_EVENT, { detail: state }),
      );
    };

    // Immediately, before uploading — so the counter starts from this exact moment.
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
        moderation_status: finalModerationStatus,
        moderation_result: finalModerationResult,
        location_type: formData.locationType,
        city,
        // Phase 7 — optional organization association. Server-side
        // validation/compatibility checks and the pending-review reset
        // happen in the enforce_organization_review_status trigger, not
        // here — this is intent only, never a status.
        ...(selectedOrgId ? { organization_id: selectedOrgId } : {}),
        ...(selectedOrgId && selectedBranchId ? { branch_id: selectedBranchId } : {}),
      };

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert([itemData])
        .select()
        .single();
      if (itemError) throw itemError;

      // A photo-less listing — no images to wait for.
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

        // From this moment, the listing with its image is visible in the
        // list. Building the vector (below) stays in the background and
        // doesn't hold up the list.
        announcePublished(item.id);

        if (imagesError) {
          console.error("DATABASE ERROR:", imagesError.message);
        } else {
          // The visual-search vector must not be lost — this is not
          // fire-and-forget. We wait and retry once if the first attempt
          // fails; if it still fails, the listing is already published (the
          // MAIN content isn't at risk), only visual search won't work for
          // this item — we notify the user with a gentle warning.
          // IMPORTANT: the vector must be built from the IMAGE, not from the
          // raw text.
          //
          // visual-search builds its query as an English "forensic
          // description" from the image (see
          // supabase/functions/visual-search). If the stored vector were
          // built from a short Tajik `title + description`, the two vectors
          // would land in completely different spaces — the correct item
          // would never be found, and random items would come up instead.
          //
          // generate-embedding fetches the images ITSELF from item_images
          // (all of them, not just the first), so `image_url` isn't sent
          // here. `text` is given to the vision model as context, so it gets
          // combined with that same English description.
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
            3 (AI check) is last, shown only when publishing (onFinalSubmit):
            1 → 2 → 4 → 5 → 3. A simple numeric comparison step > i+1 was
            wrong — once step=3, steps 4 and 5 (which had already passed)
            were incorrectly shown as empty (gray). */}
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
                    : "bg-slate-100 dark:bg-zinc-700",
              )}
            />
          ))}
        </div>

        <CardContent className="p-2 sm:p-4 md:p-6 lg:p-8 flex-1 flex flex-col justify-start pt-10 sm:pt-6 overflow-y-auto scrollbar-none">
          {/* Step 1: Photos First (Refined) */}
          {step === 1 && (
            <div className="space-y-6 w-full pt-4">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("pickImage")}
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
                {images.length < 4 && (
                  <div
                    onClick={() => setShowPhotoChoice(true)}
                    className="aspect-square flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 transition-all group order-first"
                  >
                    <div className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 rounded-full bg-canvas dark:bg-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Plus className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6" strokeWidth={3} />
                    </div>
                  </div>
                )}
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-md overflow-hidden group bg-white dark:bg-zinc-800"
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
                      className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 text-red-500 p-1.5 min-[1084px]:p-2 rounded-md transition-all z-20"
                    >
                      <X className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 min-[1920px]:w-4 min-[1920px]:h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {images.length === 0 && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNoPhoto((prev) => !prev)}
                    className={cn(
                      "text-xs min-[1084px]:text-sm font-medium tracking-wide px-4 py-2 rounded-md transition-all",
                      noPhoto
                        ? "bg-emerald-500 text-white"
                        : "text-slate-500 dark:text-zinc-400 hover:text-emerald-600",
                    )}
                  >
                    {t("noPhotoBtn")}
                  </button>
                  {noPhoto && (
                    <p className="text-[11px] min-[1084px]:text-xs text-slate-400 text-center max-w-xs px-4">
                      {t("noPhotoNote")}
                    </p>
                  )}
                </div>
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

              <Dialog open={showPhotoChoice} onOpenChange={setShowPhotoChoice}>
                <DialogContent className="max-w-[320px] rounded-md p-5 pt-11 border-none shadow-2xl gap-4 focus:ring-0 focus:outline-none">
                  <DialogHeader className="mb-2">
                    <DialogTitle className="text-lg min-[1084px]:text-xl min-[1920px]:text-2xl tracking-tight text-center text-emerald-600 dark:text-emerald-400">
                      {t("choose_photo_method")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-24 rounded-md bg-white border border-hairline dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        setShowCameraCapture(true);
                      }}
                    >
                      <div className="w-10 h-10 rounded-md bg-blue-500 flex items-center justify-center text-white transition-all">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-medium tracking-wide text-slate-500">
                        {t("camera")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col gap-2 h-24 rounded-md bg-white border border-hairline dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                      onClick={() => {
                        setShowPhotoChoice(false);
                        galleryInputRef.current?.click();
                      }}
                    >
                      <div className="w-10 h-10 rounded-md bg-orange-500 flex items-center justify-center text-white transition-all">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-medium tracking-wide text-slate-500">
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
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
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
                    className="flex items-center gap-3 rounded-md bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🔍
                    </div>
                    <div className="flex-1">
                      <span className="block font-semibold text-base min-[1084px]:text-lg leading-snug text-red-600 dark:text-red-500">
                        {t("lost")}
                      </span>
                      <span className="text-slate-400 text-[13px] min-[1084px]:text-sm font-medium">
                        {t("lost_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="lost"
                      id="lost"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-slate-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                    />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-3 rounded-md bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                      🎁
                    </div>
                    <div className="flex-1">
                      <span className="block font-semibold text-base min-[1084px]:text-lg leading-snug text-emerald-600 dark:text-emerald-500">
                        {t("found")}
                      </span>
                      <span className="text-slate-400 text-[13px] min-[1084px]:text-sm font-medium">
                        {t("found_desc")}
                      </span>
                    </div>
                    <RadioGroupItem
                      value="found"
                      id="found"
                      className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-slate-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
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
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
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
                        : (val as typeof prev.locationType),
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
                    { value: "gym", emoji: "🏋️" },
                    { value: "university", emoji: "🎓" },
                    { value: "mall", emoji: "🛍️" },
                    { value: "office", emoji: "🏢" },
                    { value: "event", emoji: "🎪" },
                    { value: "tourism", emoji: "🧳" },
                    { value: "bank", emoji: "🏦" },
                    { value: "none", emoji: "🤷" },
                  ] as const
                ).map((opt) => (
                  <div key={opt.value} className="relative">
                    <Label
                      htmlFor={`loc-${opt.value}`}
                      className="flex items-center gap-3 rounded-md bg-white dark:bg-zinc-800 p-4 min-[1084px]:p-5 ring-2 ring-transparent has-[button[data-state=checked]]:ring-emerald-500 cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center text-2xl min-[1084px]:text-3xl shrink-0">
                        {opt.emoji}
                      </div>
                      <span className="flex-1 font-semibold text-base min-[1084px]:text-lg leading-snug">
                        {opt.value === "none"
                          ? t("addItemLocationStep.notSpecified")
                          : t(`addItemLocationStep.${opt.value}`)}
                      </span>
                      <RadioGroupItem
                        value={opt.value}
                        id={`loc-${opt.value}`}
                        className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 shrink-0 border-2 border-slate-200 dark:border-zinc-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors"
                      />
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* City — swipe sideways; Dushanbe is preselected. */}
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
                          ? "bg-emerald-500 text-white"
                          : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {cityLabel(id, locale)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phase 7 — optional organization association. Only shown
                  when the chosen place type has at least one active,
                  compatible organization; never forced. */}
              {formData.locationType && !loadingOrgs && compatibleOrgs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgPickerLabel")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      aria-pressed={selectedOrgId === null}
                      onClick={() => setSelectedOrgId(null)}
                      className={cn(
                        "h-9 px-3.5 rounded-md text-sm font-semibold cursor-pointer transition-colors",
                        selectedOrgId === null
                          ? "bg-emerald-500 text-white"
                          : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {t("orgPickerNone")}
                    </button>
                    {compatibleOrgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        aria-pressed={selectedOrgId === org.id}
                        onClick={() => setSelectedOrgId(org.id)}
                        className={cn(
                          "h-9 px-3.5 rounded-md text-sm font-semibold cursor-pointer transition-colors",
                          selectedOrgId === org.id
                            ? "bg-emerald-500 text-white"
                            : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                        )}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>

                  {selectedOrgId && orgBranches.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgBranchPickerLabel")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {orgBranches.map((branch) => (
                          <button
                            key={branch.id}
                            type="button"
                            aria-pressed={selectedBranchId === branch.id}
                            onClick={() => setSelectedBranchId(branch.id)}
                            className={cn(
                              "h-9 px-3.5 rounded-md text-sm font-semibold cursor-pointer transition-colors",
                              selectedBranchId === branch.id
                                ? "bg-emerald-500 text-white"
                                : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                            )}
                          >
                            {branch.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOrgId && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                      {t("orgReviewConsentNotice")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: AI Scanning & Auto-fill (Inline Visual Search Style) */}
          {step === 3 && (
            <div className="space-y-6 text-center max-w-5xl mx-auto w-full py-2 flex-1 flex flex-col justify-start pt-4 sm:pt-6">
              {moderationStatus === "checking" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative group w-full aspect-square max-w-[85vw] sm:max-w-[40vh] lg:max-w-[30vh]">
                    {/* Soft Glow */}
                    <div className="absolute -inset-4 bg-emerald-500/10 rounded-md blur-2xl opacity-50 animate-pulse"></div>

                    {/* Image Container - Exact Visual Search Style */}
                    <div className="relative h-full w-full rounded-md overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
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
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-md flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm min-[1084px]:text-base min-[1920px]:text-lg font-semibold text-white tracking-widest whitespace-nowrap">
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
                        className="text-sm sm:text-base min-[1084px]:text-lg min-[1920px]:text-xl text-emerald-600 dark:text-emerald-400 font-semibold tracking-[0.2em] text-center"
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
                <div className="space-y-6 text-center max-w-md mx-auto p-6 bg-white dark:bg-zinc-800 rounded-md">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-red-500" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-xl min-[1503px]:text-2xl min-[1920px]:text-[26px] font-semibold tracking-tight text-red-600 dark:text-red-400">
                      {t("ai_steps.step5_failed")}
                    </h2>
                    <div className="bg-canvas dark:bg-zinc-700 p-4 rounded-md">
                      <p className="text-red-700 font-semibold text-sm leading-relaxed">
                        {moderationError || t("error")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // The final check evaluates image+text together — if
                        // the rejection reason is the image, we send the user
                        // back to the photo step (1) and clear the rejected
                        // images, so they can pick new ones; if it's only the
                        // text, we send them back to the description step (4).
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
                      className="rounded-md font-medium text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-widest mt-4 text-red-600 dark:text-red-400 border-red-200 hover:bg-red-100"
                    >
                      {t("ai_steps.step5_fix_btn")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Passed State UI — so the screen doesn't go blank/white
                  during the gap between AI approval and the final publish
                  (uploading images, writing to the database). */}
              {moderationStatus === "passed" && (
                <div className="space-y-6 max-w-sm mx-auto w-full">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-[52px] min-[1920px]:h-[52px] text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {t("success")}
                    </h2>
                    <p className="text-slate-500 dark:text-zinc-400 font-semibold text-sm tracking-tight">
                      {t("imageModeration.submitted")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(postSuccessRedirect)}
                    className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-md font-medium tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {t("done")}
                  </Button>
                </div>
              )}

              {/* Idle — when the user is in the blur dialog (privacyReview is
                  open) or AI has already returned a result before the final upload. */}
              {moderationStatus === "idle" && (
                <div className="space-y-4">
                  <div className="w-20 h-20 min-[1084px]:w-24 min-[1084px]:h-24 min-[1920px]:w-[104px] min-[1920px]:h-[104px] rounded-md bg-canvas dark:bg-zinc-700 flex items-center justify-center mx-auto">
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
                <Label className="text-[11px] min-[1084px]:text-xs tracking-wider text-slate-500 dark:text-zinc-400 ml-1">
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
                <Label className="text-[11px] min-[1084px]:text-xs tracking-wider text-slate-500 dark:text-zinc-400 ml-1">
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
                        "flex flex-col items-center gap-1 p-2 min-[1084px]:p-2.5 rounded-md bg-white dark:bg-zinc-800 ring-2 ring-transparent transition-all text-center",
                        formData.category === cat.name
                          ? "ring-2 ring-emerald-500 bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400"
                          : "text-slate-600",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 min-[1084px]:w-10 min-[1084px]:h-10 rounded-md flex items-center justify-center text-base min-[1084px]:text-lg shrink-0",
                          formData.category === cat.name
                            ? "bg-canvas"
                            : "bg-canvas",
                        )}
                      >
                        {cat.icon}
                      </div>
                      <span className="text-[10px] min-[1084px]:text-[11px] font-medium tracking-tight leading-tight">
                        {t(`categories.${cat.id}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] min-[1084px]:text-xs tracking-wider text-slate-500 dark:text-zinc-400 ml-1">
                  {t("description")}
                </Label>
                <Textarea
                  // This placeholder's promise is real: when AI is enabled,
                  // final_check cleans up the text (polished_description).
                  // When it's off, no one fixes it — so we ask the user for
                  // the full text instead.
                  placeholder={
                    aiModerationEnabled
                      ? t("descPlaceholderAi")
                      : t("descPlaceholderManual")
                  }
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
                <h2 className="text-lg min-[1084px]:text-xl min-[1503px]:text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("contactInfo") || "Contact Information"}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] min-[1084px]:text-xs tracking-wider text-slate-500 dark:text-zinc-400 ml-1">
                    {t("phoneLabel")}
                  </Label>
                  <PhoneInput
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


                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-md bg-white dark:bg-zinc-800 px-4 py-3">
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
                  <label className="flex-1 flex items-center gap-2 cursor-pointer select-none rounded-md bg-white dark:bg-zinc-800 px-4 py-3">
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
                    <label className="flex items-center gap-3 cursor-pointer select-none rounded-md bg-white dark:bg-zinc-800 px-4 py-3">
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
                      <span className="text-sm min-[1084px]:text-base font-semibold text-emerald-700 dark:text-emerald-400">
                        {t("reward_gives")}
                      </span>
                    </label>
                    {!rewardEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] min-[1084px]:text-xs tracking-wider text-slate-500 dark:text-zinc-400 ml-1">
                          {t("reward_gives_input")}
                        </Label>
                        <div className="relative">
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 font-semibold text-sm min-[1084px]:text-base text-slate-400">
                            TJS
                          </span>
                          <Input
                            placeholder={t("reward_gives_input")}
                            className="rounded-md h-13 min-[1084px]:h-14 bg-white dark:bg-zinc-800 border-none shadow-none text-base min-[1084px]:text-lg text-emerald-600 dark:text-emerald-400 pr-14 pl-5 transition-all"
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
                className="flex-1 rounded-md h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] tracking-widest text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] bg-emerald-500 hover:bg-emerald-600 text-white transition-all"
              >
                {t("next")}
              </Button>
            )}
            {step === 5 && (
              <Button
                variant="brand"
                onClick={nextStep}
                disabled={loading}
                className="flex-1 rounded-md h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] tracking-widest text-[10px] min-[1084px]:text-xs min-[1920px]:text-[13px] transition-all"
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
      <Dialog open={foundAskOpen} onOpenChange={setFoundAskOpen}>
        <DialogContent className="max-w-[360px] rounded-md p-5 pt-8 border-none shadow-2xl gap-0">
          <DialogHeader className="mb-4 space-y-1">
            <DialogTitle className="text-lg font-bold tracking-tight text-center text-zinc-900 dark:text-zinc-100">
              {t("foundAskTitle")}
            </DialogTitle>
            <p className="text-sm font-medium text-center text-slate-500">{t("foundAskHint")}</p>
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
                  } else {
                    setPoliceAdviceOpen(true);
                  }
                }}
                className="w-full flex items-center gap-3 rounded-lg border-[1.5px] border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3.5 py-3.5 text-left cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <span className="text-3xl shrink-0">{opt.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{t(opt.label)}</span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">{t(opt.hint)}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-emerald-600 shrink-0" />
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
            className="w-full h-12 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
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
              className="w-full h-14 min-[1084px]:h-16 min-[1920px]:h-[68px] rounded-md font-medium tracking-widest text-xs min-[1084px]:text-sm min-[1920px]:text-[15px] text-white bg-emerald-500 hover:bg-emerald-600"
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
