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
import { Camera, Download, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemCard } from "@/components/item-card";
import { compressImage } from "@/lib/image-utils";
import {
  embedPhoto,
  installVisualModel,
  onVisualModelDownload,
  visualModelInstalled,
  warmUpVisualModel,
  VISUAL_MODEL_SIZE_MB,
  type DownloadProgress,
} from "@/lib/visual-search";
import { useLanguage } from "@/lib/language-context";
import type { Item } from "@/lib/services/item-service";

const CameraCaptureModal = dynamic(() => import("@/components/camera-capture-modal").then((m) => m.CameraCaptureModal));

type Result = Item & { visual: { score: number; reasons: string[] } };
type Phase = { kind: "pick" } | { kind: "searching"; preview: string } | { kind: "results"; preview: string; items: Result[] } | { kind: "error"; key: string };

const ERROR_KEYS: Record<string, string> = {
  rate_limited: "imageSearchErrTimeout",
};

/** Round progress in place of the camera icon while the model downloads with the dialog closed. */
function ProgressRing({ progress }: { progress: number }) {
  const r = 7;
  const length = 2 * Math.PI * r;
  const done = Math.min(1, Math.max(0.04, progress));
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" role="img" aria-label={`${Math.round(progress * 100)}%`}>
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-zinc-200 dark:stroke-zinc-700" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - done)}
        transform="rotate(-90 9 9)"
        className="stroke-primary transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

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
  const [download, setDownload] = useState<DownloadProgress | null>(null);
  useEffect(() => onVisualModelDownload(setDownload), []);
  // The model is a one-time download: until it is in this browser the dialog
  // offers to install it (with its size) instead of camera/gallery.
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  // Before the first byte arrives the bar starts at 0%, not 100%.
  const fraction = download ? download.loaded / Math.max(1, download.total) : 0;
  const percent = Math.min(100, Math.round(fraction * 100));
  const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
  const sizeText = download ? `${mb(download.loaded)} МБ / ${mb(download.total)} МБ` : "";

  const openDialog = () => {
    // Reopened while the model is still downloading: show its progress again.
    if (installing) {
      setOpen(true);
      return;
    }
    setPhase({ kind: "pick" });
    setInstallFailed(false);
    setOpen(true);
    void visualModelInstalled().then((ok) => {
      setInstalled(ok);
      if (ok) warmUpVisualModel();
    });
  };

  const install = async () => {
    if (installing) return;
    setInstalling(true);
    setInstallFailed(false);
    try {
      await installVisualModel();
      setInstalled(true);
      warmUpVisualModel();
    } catch {
      setInstallFailed(true);
    } finally {
      setInstalling(false);
    }
  };

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
        onClick={openDialog}
        aria-label={t("imageSearchTitle")}
        title={t("imageSearchTitle")}
        className="p-1.5 text-slate-500 hover:text-primary transition-colors cursor-pointer"
      >
        {installing ? <ProgressRing progress={fraction} /> : <Camera className="h-4 w-4" />}
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

          {phase.kind === "pick" && installed === null && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase.kind === "pick" && installed === false && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="grid size-12 place-items-center rounded-md bg-found-soft">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold">{t("imageSearchInstallTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("imageSearchInstallDesc").replace("{size}", String(VISUAL_MODEL_SIZE_MB))}
              </p>
              {installFailed && (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
                  {t("imageSearchInstallFailed")}
                </p>
              )}
              {installing ? (
                // Instead of a spinner: one long bar with the percentage. The
                // dialog may be closed — the download goes on and the camera
                // button in the search bar shows its progress.
                <div className="w-full space-y-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-tile">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: percent + "%" }} />
                    </div>
                    <span className="w-12 text-right text-sm font-bold tabular-nums text-primary">{percent}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground" aria-live="polite">
                    <span>{t("imageSearchInstalling").replace("{percent}", String(percent))}</span>
                    {sizeText && <span className="shrink-0 tabular-nums">{sizeText}</span>}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={install}
                  className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  {t("imageSearchInstallBtn").replace("{size}", String(VISUAL_MODEL_SIZE_MB))}
                </button>
              )}
            </div>
          )}

          {phase.kind === "pick" && installed && (
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
              <p className="text-sm font-semibold">
                {download === null
                  ? t("imageSearchAnalyzing")
                  : t("imageSearchDownloading").replace("{percent}", String(percent))}
              </p>
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
