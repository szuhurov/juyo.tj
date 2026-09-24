/**
 * Organization-owned FOUND post creation — staff action (owner/admin/
 * branch_manager/staff; the RPC re-checks this exactly, this page never
 * decides authorization). user_id stays NULL, organization_id/branch_id
 * are required, created_by_staff_id (set server-side from the Clerk JWT)
 * is an audit/creator reference ONLY, never authorization. This is an
 * "Organization FOUND Post" — never "Verification"/"Claim"/"Ownership
 * Proof": the organization owns the post context, the staff member is
 * only the creator. Reuses the existing items pipeline
 * (create_organization_found_item inserts into the same `items` table)
 * and the same AI safety check the personal Add Item flow uses —
 * moderation is not bypassed.
 *
 * Web has no organization-management UI at all yet (only this page and
 * the review queue) — per the Phase 7 "absolute final gap closure" scope,
 * this is the minimum Web UI needed for the org-owned FOUND workflow, not
 * a full org section.
 */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
import { stripDocumentNumbers } from "@/lib/utils";
import { CATEGORIES } from "@/lib/services/item-service";
import { CITY_IDS, DEFAULT_CITY, cityLabel } from "@/lib/cities";
import {
  OrganizationService, type MyOrganization,
} from "@/lib/services/organization-service";
import {
  OrganizationItemService, type OrganizationBranchOption,
} from "@/lib/services/organization-item-service";
import { PrivacyBlurEditor, type PrivacyRegion } from "@/components/privacy-blur-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, ArrowLeft, Plus, X, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrganizationFoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = use(params);
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded } = useAuth();

  const [mine, setMine] = useState<MyOrganization | null>(null);
  const [branches, setBranches] = useState<OrganizationBranchOption[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(DEFAULT_CITY);
  const [branchId, setBranchId] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [privacyReview, setPrivacyReview] = useState<{
    files: File[];
    regions: PrivacyRegion[];
    resolve: (result: File[] | null) => void;
  } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadingContext(true);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const orgs = await OrganizationService.getMyOrganizations(supabase);
      const found = orgs.find((o) => o.organizationId === organizationId) ?? null;
      setMine(found);
      if (found && ["owner", "admin"].includes(found.role)) {
        const branchOptions = await OrganizationItemService.getOrganizationBranchesForPicker(organizationId, undefined, supabase);
        setBranches(branchOptions);
        setBranchId(branchOptions.length === 1 ? branchOptions[0].id : null);
      } else if (found?.branchId) {
        setBranchId(found.branchId);
      }
    } finally {
      setLoadingContext(false);
    }
  }, [organizationId, userId, getToken]);

  useEffect(() => {
    if (isLoaded) load();
  }, [isLoaded, load]);

  const canCreate = mine && ["owner", "admin", "branch_manager", "staff"].includes(mine.role);
  const isOrgWide = mine && ["owner", "admin"].includes(mine.role);

  const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length);
    if (files.length === 0) return;
    setImages((prev) => [...prev, ...files].slice(0, 4));
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))].slice(0, 4));
    e.target.value = "";
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (submitting || checking) return;
    if (!branchId) { toast.error(t("orgFoundBranchRequired")); return; }
    if (!title.trim() || !category || !description.trim()) { toast.error(t("orgFoundTitleDescRequired")); return; }

    let finalImages = images;
    let finalTitle = title.trim();
    let finalDescription = description.trim();
    let finalCategory = category;

    // The same single AI safety check the personal Add Item flow runs
    // (mode=final_check, via /api/items/moderate) — organization-owned
    // posts are not exempt from moderation. create_organization_found_item
    // has no moderation_status parameter (verified via static review), so
    // this call is purely a pre-submission safety/quality gate — the item
    // still lands 'pending' and awaits the existing moderation path either way.
    if (images.length > 0) {
      setChecking(true);
      setFailed(null);
      try {
        const finalCheckData = new FormData();
        const compressed = await Promise.all(images.map((img) => compressImage(img, 1024, 0.7)));
        compressed.forEach((img) => finalCheckData.append("image", img));
        finalCheckData.append("title", finalTitle);
        finalCheckData.append("description", finalDescription);
        finalCheckData.append("lang", locale);
        finalCheckData.append("type", "found");
        finalCheckData.append("mode", "final_check");

        const checkRes = await fetch("/api/items/moderate", { method: "POST", body: finalCheckData });
        const checkData = await checkRes.json().catch(() => null);
        const checkError = !checkRes.ok ? new Error(checkData?.error || t("error")) : null;

        if (checkError || (checkData && checkData.is_safe === false)) {
          setChecking(false);
          setFailed(checkData?.reason || checkError?.message || t("error"));
          return;
        }

        finalTitle = checkData?.polished_title || finalTitle;
        finalDescription = checkData?.polished_description || finalDescription;

        if (checkData?.is_document) {
          finalTitle = stripDocumentNumbers(finalTitle);
          finalDescription = stripDocumentNumbers(finalDescription);
          finalCategory = "Documents";
          setChecking(false);
          const suggestedRegions: PrivacyRegion[] = checkData.privacy_regions ?? [];
          const blurred = await new Promise<File[] | null>((resolve) => {
            setPrivacyReview({ files: images, regions: suggestedRegions, resolve });
          });
          if (!blurred) return;
          setImages(blurred);
          finalImages = blurred;
        }
      } catch {
        setChecking(false);
        setFailed(t("error"));
        return;
      }
      setChecking(false);
    }

    setSubmitting(true);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const imageUrls: string[] = [];
      for (const file of finalImages) {
        const compressedFile = await compressImage(file);
        const ext = compressedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("items").upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("items").getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      await OrganizationItemService.createOrganizationFoundItem({
        organizationId,
        branchId,
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        date: new Date().toISOString().split("T")[0],
        city,
        imageUrls,
      }, supabase);
      setDone(true);
    } catch {
      // Never surface the raw RPC/database error text to the user.
      toast.error(t("orgFoundCreateError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loadingContext) {
    return (
      <div className="max-w-lg mx-auto px-2.5 sm:px-4 py-6 sm:py-8 space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="max-w-lg mx-auto px-2.5 sm:px-4 py-20 text-center">
        <p className="text-sm font-medium text-red-500">{t("orgFoundNotAuthorized")}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-2.5 sm:px-4 py-20 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-500" />
        </div>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t("success")}</p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">{t("orgFoundCreateSuccess")}</p>
        <Button onClick={() => router.push(`/org/${organizationId}/review`)}>{t("done")}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-2.5 sm:px-4 py-6 sm:py-8 space-y-5">
      <div className="sticky top-0 z-30 bg-canvas py-3 mb-1 flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <button type="button" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <Building2 className="w-5 h-5 text-sky-500 shrink-0" />
        <h1 className="flex-1 text-base font-bold tracking-tight text-slate-500 dark:text-zinc-400 ml-1">
          {t("orgFoundCreateTitle")}
        </h1>
      </div>

      {checking ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("orgFoundAiChecking")}</p>
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
          <ShieldAlert className="w-10 h-10 text-red-600" />
          <p className="text-sm font-medium text-red-500">{failed}</p>
          <Button variant="outline" onClick={() => setFailed(null)}>{t("orgFoundAiRetry")}</Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">{t("orgFoundBadgeExplainer")}</p>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgFoundPhotosLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative w-20 h-20 rounded-md overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <label className="w-20 h-20 rounded-md border border-dashed border-hairline dark:border-zinc-700 flex items-center justify-center cursor-pointer bg-white dark:bg-zinc-800">
                  <Plus className="w-5 h-5 text-zinc-400" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgFoundCategoryLabel")}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={cn(
                    "h-9 px-3.5 rounded-md text-sm font-semibold transition-colors",
                    category === cat.name ? "bg-emerald-500 text-white" : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {cat.icon} {t(`categories.${cat.id}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgFoundTitleLabel")}</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgFoundDescLabel")}</p>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("cityLabel")}</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-1">
              {CITY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCity(id)}
                  className={cn(
                    "shrink-0 h-9 px-3.5 rounded-md text-sm font-semibold transition-colors",
                    city === id ? "bg-emerald-500 text-white" : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {cityLabel(id, locale)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t("orgBranchPickerLabel")}</p>
            {isOrgWide ? (
              <div className="flex flex-wrap gap-1.5">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBranchId(b.id)}
                    className={cn(
                      "h-9 px-3.5 rounded-md text-sm font-semibold transition-colors",
                      branchId === b.id ? "bg-emerald-500 text-white" : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("orgFoundBranchLocked")}</p>
            )}
          </div>

          <Button variant="brand" className="w-full h-11" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("orgFoundCreateSubmit")}
          </Button>
        </>
      )}

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
    </div>
  );
}
