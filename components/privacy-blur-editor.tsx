/**
 * Муҳаррири ҳимояи махфият — вақте ки AI moderation (final_check/
 * moderation_only дар ai-brain) муайян кард, ки акс ҳуҷҷат аст
 * (is_document), ин тиреза кушода мешавад. Ягон даъвати AI-и АЛОҲИДА
 * барои ин кор намешавад — ҳамон санҷиши moderation-е, ки аллакай
 * иҷро шудааст, минтақаҳои пешниҳодшударо низ медиҳад (privacy_regions),
 * то суръат гум нашавад. Корбар метавонад ин минтақаҳоро қабул кунад
 * ё бо "қалам" (кашидан бо муш/ангушт) худаш илова/андоза/ҳаракат/нест
 * кунад. Ҳама минтақа pixelate (мозаика, на blur-и оддӣ — зеро blur
 * баъзан баргардонида мешавад, pixelation не) мешавад.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, ZoomIn, ZoomOut, Trash2, ShieldCheck, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export interface PrivacyRegion {
  label?: string;
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

interface EditableRegion {
  id: string;
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

type DragKind = "new" | "move" | "resize";
type Corner = "nw" | "ne" | "sw" | "se";

interface DragState {
  kind: DragKind;
  regionId: string;
  corner?: Corner;
  startPointerX: number; // 0-1
  startPointerY: number; // 0-1
  startRegion: EditableRegion;
  // Барои "new": ҳамаи нуқтаҳои роҳи қалам — bbox дар анҷом аз инҳо ҳисоб мешавад.
  pathMinX?: number;
  pathMinY?: number;
  pathMaxX?: number;
  pathMaxY?: number;
}

const MAX_WORKING_WIDTH = 1400;
const MIN_SIZE = 0.03; // Ҳадди ақали минтақа — то каши хеле хурд/тасодуфӣ намонад
const PEN_PADDING = 0.02; // Изофаи атрофи роҳи қалам, то мукаммал пӯшад
const AI_REGION_PADDING = 0.02; // Изофаи атрофи ҳар минтақаи пешниҳодкардаи AI

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Пахши сиёҳи пурра — на pixelation. Pixelation бо блокҳои хурд то ҳол
// шакли рақамҳоро нигоҳ медошт (баъзан хонда мешуд, махсусан дар канори
// минтақа ё агар матн калон бошад). Пахши як-ранга ҳеҷ маълумоти аслии
// пикселро намемонад — 100% хонданашаванда, новобаста аз андозаи матн.
function redactRect(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const cx = Math.max(0, Math.round(x));
  const cy = Math.max(0, Math.round(y));
  const cw = Math.min(canvasWidth - cx, Math.round(w));
  const ch = Math.min(canvasHeight - cy, Math.round(h));
  if (cw <= 0 || ch <= 0) return;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(cx, cy, cw, ch);
}

export function PrivacyBlurEditor({
  open,
  file,
  initialRegions,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  file: File | null;
  /** Минтақаҳои пешниҳодкардаи ҳамон санҷиши moderation-е, ки аллакай
   * иҷро шудааст (privacy_regions) — корбар метавонад қабул кунад ё
   * бо қалам худаш иваз/илова/нест кунад. */
  initialRegions?: PrivacyRegion[];
  onConfirm: (finalFile: File) => void;
  /** Пахши "×"/Escape/click-и берун — акси ҳозира аз рӯйхат нест карда мешавад
   * (акси бе тасдиқ ҳаргиз ба upload намеравад). */
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [regions, setRegions] = useState<EditableRegion[]>([]);
  const [history, setHistory] = useState<EditableRegion[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Боркунии акс дар canvas-и корӣ (андозаи маҳдуд барои суръат) — минтақаҳо
  // бо пешниҳоди AI (агар бошад) сар мешаванд, вале пурра қобили таҳриранд.
  useEffect(() => {
    if (!file || !open) {
      setReady(false);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      if (cancelled) return;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_WORKING_WIDTH) {
        h = Math.round((h * MAX_WORKING_WIDTH) / w);
        w = MAX_WORKING_WIDTH;
      }
      const base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      const bctx = base.getContext("2d");
      bctx?.drawImage(img, 0, 0, w, h);
      baseRef.current = base;

      // Минтақаҳои пешниҳодкардаи AI бо изофаи хурд бор мешаванд — координатаи
      // AI баъзан каме нодуруст аст (масалан дар MRZ-и поён), пас изофа
      // кӯмак мекунад, ки матн пурра пӯшида шавад, на канораш кушода монад.
      const initial: EditableRegion[] = (initialRegions ?? []).map((r, i) => {
        const x = Math.max(0, r.x - AI_REGION_PADDING);
        const y = Math.max(0, r.y - AI_REGION_PADDING);
        const width = Math.min(1 - x, r.width + AI_REGION_PADDING * 2);
        const height = Math.min(1 - y, r.height + AI_REGION_PADDING * 2);
        return { id: `ai-${i}-${Date.now()}`, x, y, width, height };
      });
      setRegions(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      setZoom(1);
      setSelectedId(null);
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [file, open]);

  // Рендери canvas: акси асосӣ + пахши сиёҳи ҳар минтақа
  const render = useCallback(() => {
    const base = baseRef.current;
    const canvas = canvasRef.current;
    if (!base || !canvas) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    for (const r of regions) {
      redactRect(
        ctx,
        base.width,
        base.height,
        r.x * base.width,
        r.y * base.height,
        r.width * base.width,
        r.height * base.height,
      );
    }
  }, [regions]);

  useEffect(() => {
    render();
  }, [render]);

  const pushHistory = (next: EditableRegion[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    const newHistory = [...trimmed, next];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setRegions(next);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    setHistoryIndex((i) => i - 1);
    setRegions(history[historyIndex - 1]);
    setSelectedId(null);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    setRegions(history[historyIndex + 1]);
    setSelectedId(null);
  };

  const getRelPos = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const handleWrapPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const role = target.dataset.role;
    const regionId = target.dataset.regionId;
    const pos = getRelPos(e);
    (wrapRef.current as any)?.setPointerCapture?.(e.pointerId);

    if (role === "handle" && regionId) {
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      setSelectedId(regionId);
      dragRef.current = {
        kind: "resize",
        regionId,
        corner: target.dataset.corner as Corner,
        startPointerX: pos.x,
        startPointerY: pos.y,
        startRegion: region,
      };
      return;
    }
    if (role === "body" && regionId) {
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      setSelectedId(regionId);
      dragRef.current = {
        kind: "move",
        regionId,
        startPointerX: pos.x,
        startPointerY: pos.y,
        startRegion: region,
      };
      return;
    }

    // Каши холӣ — ин ҳамеша "қалам"-и нав аст (addMode лозим нест,
    // кашидан худи амали пешфарз аст).
    const id = `region-new-${Date.now()}`;
    const newRegion: EditableRegion = { id, x: pos.x, y: pos.y, width: 0, height: 0 };
    setRegions((prev) => [...prev, newRegion]);
    setSelectedId(id);
    dragRef.current = {
      kind: "new",
      regionId: id,
      startPointerX: pos.x,
      startPointerY: pos.y,
      startRegion: newRegion,
      pathMinX: pos.x,
      pathMinY: pos.y,
      pathMaxX: pos.x,
      pathMaxY: pos.y,
    };
  };

  const handleWrapPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = getRelPos(e);

    if (drag.kind === "new") {
      // Роҳи қаламро васеъ мекунем (на танҳо аввал→ҳозир, балки ҳамаи
      // нуқтаҳое, ки қалам аз онҳо гузашт) — то каши каҷ низ пурра пӯшида шавад.
      drag.pathMinX = Math.min(drag.pathMinX!, pos.x);
      drag.pathMinY = Math.min(drag.pathMinY!, pos.y);
      drag.pathMaxX = Math.max(drag.pathMaxX!, pos.x);
      drag.pathMaxY = Math.max(drag.pathMaxY!, pos.y);
      const x = Math.max(0, drag.pathMinX - PEN_PADDING);
      const y = Math.max(0, drag.pathMinY - PEN_PADDING);
      const width = Math.min(1 - x, drag.pathMaxX - drag.pathMinX + PEN_PADDING * 2);
      const height = Math.min(1 - y, drag.pathMaxY - drag.pathMinY + PEN_PADDING * 2);
      setRegions((prev) =>
        prev.map((r) => (r.id === drag.regionId ? { ...r, x, y, width, height } : r)),
      );
      return;
    }

    const dx = pos.x - drag.startPointerX;
    const dy = pos.y - drag.startPointerY;
    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== drag.regionId) return r;
        if (drag.kind === "move") {
          const maxX = 1 - drag.startRegion.width;
          const maxY = 1 - drag.startRegion.height;
          return {
            ...r,
            x: Math.max(0, Math.min(maxX, drag.startRegion.x + dx)),
            y: Math.max(0, Math.min(maxY, drag.startRegion.y + dy)),
          };
        }
        // resize
        const orig = drag.startRegion;
        let { x, y, width, height } = orig;
        const right = orig.x + orig.width;
        const bottom = orig.y + orig.height;
        if (drag.corner === "se") {
          width = Math.max(MIN_SIZE, clamp01(orig.x + orig.width + dx) - orig.x);
          height = Math.max(MIN_SIZE, clamp01(orig.y + orig.height + dy) - orig.y);
        } else if (drag.corner === "nw") {
          const newX = clamp01(orig.x + dx);
          const newY = clamp01(orig.y + dy);
          x = Math.min(newX, right - MIN_SIZE);
          y = Math.min(newY, bottom - MIN_SIZE);
          width = right - x;
          height = bottom - y;
        } else if (drag.corner === "ne") {
          const newY = clamp01(orig.y + dy);
          y = Math.min(newY, bottom - MIN_SIZE);
          height = bottom - y;
          width = Math.max(MIN_SIZE, clamp01(orig.x + orig.width + dx) - orig.x);
        } else if (drag.corner === "sw") {
          const newX = clamp01(orig.x + dx);
          x = Math.min(newX, right - MIN_SIZE);
          width = right - x;
          height = Math.max(MIN_SIZE, clamp01(orig.y + orig.height + dy) - orig.y);
        }
        return { ...r, x, y, width, height };
      }),
    );
  };

  const handleWrapPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    setRegions((prev) => {
      // Каши хеле хурд (пахши тасодуфӣ бе кашидан) — ба ҳадди ақал мерасонем,
      // на бекор мекунем, то як tap-и оддӣ низ доғи дидашавандаи блур диҳад.
      const cleaned = prev.map((r) => {
        if (r.id !== drag.regionId) return r;
        if (r.width >= MIN_SIZE && r.height >= MIN_SIZE) return r;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        return {
          ...r,
          x: clamp01(cx - MIN_SIZE / 2),
          y: clamp01(cy - MIN_SIZE / 2),
          width: MIN_SIZE,
          height: MIN_SIZE,
        };
      });
      pushHistory(cleaned);
      return cleaned;
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const next = regions.filter((r) => r.id !== selectedId);
    setSelectedId(null);
    pushHistory(next);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const finalFile = new File([blob], file.name, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        onConfirm(finalFile);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl gap-0">
        <DialogHeader className="p-6 pb-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                {t("privacyReviewTitle")}
              </DialogTitle>
              <p className="text-xs font-bold text-zinc-400 mt-0.5">
                {t("privacyReviewDesc")}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6">
          <div
            ref={wrapRef}
            className="relative w-full select-none rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 touch-none"
            style={{ maxHeight: "55vh", overflow: zoom > 1 ? "auto" : "hidden", cursor: "crosshair" }}
            onPointerDown={handleWrapPointerDown}
            onPointerMove={handleWrapPointerMove}
            onPointerUp={handleWrapPointerUp}
            onPointerCancel={handleWrapPointerUp}
          >
            <div style={{ width: `${zoom * 100}%`, position: "relative" }}>
              {!ready ? (
                <div className="w-full aspect-square animate-pulse bg-zinc-200 dark:bg-zinc-800" />
              ) : (
                <>
                  <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
                  {regions.map((r) => {
                    const selected = r.id === selectedId;
                    return (
                      <div key={r.id}>
                        <div
                          data-role="body"
                          data-region-id={r.id}
                          className={cn(
                            "absolute border-2 cursor-move",
                            selected
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-white/80 hover:border-emerald-400",
                          )}
                          style={{
                            left: `${r.x * 100}%`,
                            top: `${r.y * 100}%`,
                            width: `${r.width * 100}%`,
                            height: `${r.height * 100}%`,
                          }}
                        />
                        {selected && (
                          <>
                            {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
                              <div
                                key={corner}
                                data-role="handle"
                                data-region-id={r.id}
                                data-corner={corner}
                                className="absolute w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-md"
                                style={{
                                  left: `${(corner.includes("w") ? r.x : r.x + r.width) * 100}%`,
                                  top: `${(corner.includes("n") ? r.y : r.y + r.height) * 100}%`,
                                  transform: "translate(-50%, -50%)",
                                  cursor:
                                    corner === "nw" || corner === "se"
                                      ? "nwse-resize"
                                      : "nesw-resize",
                                }}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={deleteSelected}
                              className="absolute w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                              style={{
                                left: `${(r.x + r.width) * 100}%`,
                                top: `${r.y * 100}%`,
                                transform: "translate(-30%, -70%)",
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={deleteSelected}
              disabled={!selectedId}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            className="w-full h-12 rounded-xl font-black tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            {t("privacyConfirmBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
