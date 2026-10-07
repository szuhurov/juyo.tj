"use client";

/**
 * "Search by photo": the camera button in the home search bar and its dialog.
 * The photo is analysed IN THIS BROWSER (lib/visual-search.ts) and never
 * uploaded; only its vector and pHash go to /api/search/image. Results are
 * possible matches for a person to check, never "this is your item".
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Camera, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemCard } from "@/components/item-card";
import { compressImage } from "@/lib/image-utils";
import { embedPhoto, warmUpVisualModel } from "@/lib/visual-search";
import { useLanguage } from "@/lib/language-context";
import type { Item } from "@/lib/services/item-service";

const CameraCaptureModal = dynamic(() => import("@/components/camera-capture-modal").then((m) => m.CameraCaptureModal));

type Result = Item & { visual: { score: number; reasons: string[] } };
type Phase = { kind: "pick" } | { kind: "searching"; preview: string } | { kind: "results"; preview: string; items: Result[] } | { kind: "error"; key: string };

const ERROR_KEYS: Record<string, string> = {
  rate_limited: "imageSearchErrTimeout",
};

function badgeKey(reasons: string[]) {
  if (reasons.includes("same_photo")) return "imageSearchSamePhoto";
  if (reasons.includes("very_similar")) return "imageSearchVerySimilar";
  return "imageSearchSimilar";
}

export function ImageSearchButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  // The home filters, as ranking preferences only (a nearby/same-category
  // look-alike ranks first; nothing is filtered out).
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase.kind !== "searching") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase.kind]);

  // Object URLs are released when the photo changes or the dialog closes.
  const preview = phase.kind === "searching" || phase.kind === "results" ? phase.preview : null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const search = async (file: File) => {
    const run = ++runRef.current;
    let body: File;
    try {
      body = await compressImage(file);
    } catch {
      setPhase({ kind: "error", key: "imageSearchErrBadFile" });
      return;
    }
    setElapsed(0);
    setPhase({ kind: "searching", preview: URL.createObjectURL(body) });
    let query: Awaited<ReturnType<typeof embedPhoto>>;
    try {
      // Same 1000 px JPEG as a published listing photo, analysed here.
      query = await embedPhoto(body);
    } catch {
      if (run === runRef.current) setPhase({ kind: "error", key: "imageSearchErrUnavailable" });
      return;
    }
    if (run !== runRef.current) return;
    try {
      const res = await fetch("/api/search/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...query, prefer_city: params.get("city") ?? undefined, prefer_category: params.get("cat") ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (run !== runRef.current) return;
      if (!res.ok) {
        setPhase({ kind: "error", key: ERROR_KEYS[data.error] ?? (res.status === 429 ? "imageSearchErrTimeout" : "imageSearchErrUnavailable") });
        return;
      }
      setPhase((p) => ({ kind: "results", preview: p.kind === "searching" ? p.preview : "", items: data.items ?? [] }));
    } catch {
      if (run === runRef.current) setPhase({ kind: "error", key: "imageSearchErrNetwork" });
    }
  };

  const reset = () => {
    runRef.current++;
    setPhase({ kind: "pick" });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); warmUpVisualModel(); }}
        aria-label={t("imageSearchTitle")}
        title={t("imageSearchTitle")}
        className="p-1.5 text-slate-500 hover:text-primary transition-colors cursor-pointer"
      >
        <Camera className="h-4 w-4" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void search(f);
        }}
      />

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
        <DialogContent className="sm:max-w-2xl rounded-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("imageSearchTitle")}</DialogTitle>
            <DialogDescription>{t("imageSearchDesc")}</DialogDescription>
          </DialogHeader>

          {phase.kind === "pick" && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCameraOpen(true)} className="pressable flex flex-col items-center gap-2 rounded-md border border-hairline dark:border-zinc-700 p-6 text-sm font-semibold">
                <Camera className="h-6 w-6 text-primary" />
                {t("imageSearchTake")}
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="pressable flex flex-col items-center gap-2 rounded-md border border-hairline dark:border-zinc-700 p-6 text-sm font-semibold">
                <ImageUp className="h-6 w-6 text-primary" />
                {t("imageSearchPick")}
              </button>
            </div>
          )}

          {phase.kind === "searching" && (
            <div className="flex flex-col items-center gap-4 py-4" aria-live="polite">
              <div className="relative h-40 w-40 overflow-hidden rounded-md">
                <Image src={phase.preview} alt="" fill className="object-cover opacity-70" unoptimized />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-white drop-shadow" />
                </div>
              </div>
              <p className="text-sm font-semibold">{t("imageSearchAnalyzing")}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{elapsed}s</p>
            </div>
          )}

          {phase.kind === "results" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold" aria-live="polite">
                  {phase.items.length ? t("imageSearchResults").replace("{count}", String(phase.items.length)) : t("imageSearchNone")}
                </p>
                <button type="button" onClick={reset} className="pressable flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <RotateCcw className="h-4 w-4" />
                  {t("imageSearchAgain")}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {phase.items.map((item) => (
                  <div key={item.id} className="relative">
                    <ItemCard item={item} />
                    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {t(badgeKey(item.visual.reasons))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase.kind === "error" && (
            <div className="space-y-3 py-2 text-center" role="alert">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t(phase.key)}</p>
              <button type="button" onClick={reset} className="pressable inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                <RotateCcw className="h-4 w-4" />
                {t("imageSearchAgain")}
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">{t("imageSearchPrivacy")}</p>
        </DialogContent>
      </Dialog>

      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setCameraOpen(false);
          void search(file);
        }}
      />
    </>
  );
}
