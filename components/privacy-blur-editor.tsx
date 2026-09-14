/**
 * Privacy protection editor — opens when AI moderation (final_check/
 * moderation_only in ai-brain) determines the image is a document
 * (is_document). No SEPARATE AI call is made for this — the same
 * moderation check that already ran also returns suggested regions
 * (privacy_regions), so no speed is lost. The user can accept these
 * regions or add/resize/move/delete them manually with a "pen" (dragging
 * with mouse/finger). Every region is pixelated (mosaic, not a plain
 * blur — because blur can sometimes be reversed, pixelation cannot).
 *
 * AI regions are also FULLY editable. Previously they were locked, but
 * the vision model's coordinates can drift — in one real passport the
 * box drifted to the right of the actual number, and the user could see
 * the problem but couldn't fix it.
 *
 * Multiple images at once: all images are reviewed in this ONE dialog
 * with left/right buttons (not one at a time in separate dialogs) — so
 * the user can freely move between images and go back to a previous one
 * before final confirmation.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, X, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export interface PrivacyRegion {
  label?: string;
  /** Which image this refers to (0-based), when several images are sent
   *  to ai-brain together — see the decodeSlot comment below. */
  imageIndex?: number;
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
  rotation: number; // degrees, 0-360
  /** Only affects the border style — both kinds are equally editable.
   *  "ai" — AI suggestion (dashed border). "user" — drawn with the pen. */
  origin: "ai" | "user";
}

interface ImageSlot {
  file: File;
  base: HTMLCanvasElement | null;
  regions: EditableRegion[];
  history: EditableRegion[][];
  historyIndex: number;
}

type DragKind = "new" | "move" | "resize" | "rotate";
type Corner = "nw" | "ne" | "sw" | "se";

interface DragState {
  kind: DragKind;
  regionId: string;
  corner?: Corner;
  startPointerX: number; // 0-1
  startPointerY: number; // 0-1
  startRegion: EditableRegion;
  // For "new": all points along the pen's path — the bbox at the end is computed from these.
  pathMinX?: number;
  pathMinY?: number;
  pathMaxX?: number;
  pathMaxY?: number;
}

const MAX_WORKING_WIDTH = 1400;
const MIN_SIZE = 0.03; // Minimum region size — so a very small/accidental drag doesn't stick around
const PEN_PADDING = 0.02; // Padding around the pen's path, so it covers fully
const AI_REGION_MAX_AREA = 0.25; // Max area of a single AI region (relative to the total image area) — if AI made a mistake and gave an oversized region (e.g. almost the whole document), it's shrunk to this size.

// Padding for AI regions. Vision models don't give EXACT coordinates —
// the box typically drifts by 3-8%. A fixed 2% padding didn't cover this
// drift: in one real passport the number's box drifted to the right and
// the number itself was left exposed. Now the padding is PROPORTIONAL —
// a small box gets relatively more padding, because drift is most
// damaging exactly for small boxes.
const AI_PAD_MIN = 0.02;
const AI_PAD_X_RATIO = 0.18;
const AI_PAD_Y_RATIO = 0.55;

// MRZ (the machine-readable lines at the bottom of a passport/ID) — this
// is the one field whose structure is known IN ADVANCE: it's always a
// FULL-width strip of the document, 2-3 monospace lines at the bottom.
// The model, however, gives it as a small box and covers only part of
// it. So for MRZ we don't rely on the model's coordinates: we open the
// width to 100% and extend the height to cover the whole strip.
const MRZ_MIN_HEIGHT = 0.1;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function isMrzLabel(label?: string) {
  return !!label && /mrz|machine[\s_-]?readable/i.test(label);
}

function initialRegionsFor(suggested: PrivacyRegion[] | undefined): EditableRegion[] {
  return (suggested ?? []).map((r, i) => {
    const mrz = isMrzLabel(r.label);

    let x: number, y: number, width: number, height: number;

    if (mrz) {
      const centerY = r.y + r.height / 2;
      height = Math.min(1, Math.max(r.height, MRZ_MIN_HEIGHT) + AI_PAD_MIN * 2);
      x = 0;
      width = 1;
      y = clamp01(centerY - height / 2);
      height = Math.min(1 - y, height);
    } else {
      const padX = Math.max(AI_PAD_MIN, r.width * AI_PAD_X_RATIO);
      const padY = Math.max(AI_PAD_MIN, r.height * AI_PAD_Y_RATIO);
      x = Math.max(0, r.x - padX);
      y = Math.max(0, r.y - padY);
      width = Math.min(1 - x, r.width + padX * 2);
      height = Math.min(1 - y, r.height + padY * 2);

      // If AI suggests a way-too-large region (e.g. from a decoding
      // error), we shrink it to the max area while keeping it centered
      // on itself — so the whole document never ends up covered.
      // MRZ is exempt from this rule — the full strip is deliberately large.
      if (width * height > AI_REGION_MAX_AREA) {
        const scale = Math.sqrt(AI_REGION_MAX_AREA / (width * height));
        const cx = x + width / 2;
        const cy = y + height / 2;
        width *= scale;
        height *= scale;
        x = clamp01(cx - width / 2);
        y = clamp01(cy - height / 2);
      }
    }

    return {
      id: `ai-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      x,
      y,
      width,
      height,
      rotation: 0,
      origin: "ai" as const,
    };
  });
}

// "Contain"-fit calculation — the image must fit entirely within the
// working area, not be cropped by width (if it's tall) nor by height (if
// it's wide). Always computed from the container's ACTUAL current size
// (not an estimated size at the moment the image loads — so the image
// doesn't get cropped/overflow the dialog during its opening animation).
function fitContain(naturalW: number, naturalH: number, availW: number, availH: number) {
  if (!naturalW || !naturalH || !availW || !availH) return { w: 0, h: 0 };
  let dispW = availW;
  let dispH = (dispW * naturalH) / naturalW;
  if (dispH > availH) {
    dispH = availH;
    dispW = (dispH * naturalW) / naturalH;
  }
  return { w: dispW, h: dispH };
}

// Loads and decodes a single image into a working canvas (size capped
// for speed) — regions start out with the AI suggestions (if any).
function decodeSlot(file: File, suggested: PrivacyRegion[] | undefined): Promise<ImageSlot> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
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

      const initial = initialRegionsFor(suggested);
      URL.revokeObjectURL(url);
      resolve({
        file,
        base,
        regions: initial,
        history: [initial],
        historyIndex: 0,
      });
    };
    img.src = url;
  });
}

// A crisp mosaic with hard block edges (sharp, not blurry) — the same
// look we originally produced with the pen. Blocks are larger than the
// first attempt (up to 7 cells along the shorter side) — so no
// letter/digit shape survives, while still keeping the clear "big pixel"
// look (not a solid black fill, not a smooth blur).
function redactRect(
  source: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg = 0,
) {
  const cx = Math.max(0, Math.round(x));
  const cy = Math.max(0, Math.round(y));
  const cw = Math.min(source.width - cx, Math.round(w));
  const ch = Math.min(source.height - cy, Math.round(h));
  if (cw <= 0 || ch <= 0) return;

  const shortCells = 7;
  const blockSize = Math.max(8, Math.round(Math.min(cw, ch) / shortCells));
  const smallW = Math.max(1, Math.ceil(cw / blockSize));
  const smallH = Math.max(1, Math.ceil(ch / blockSize));

  const tmp = document.createElement("canvas");
  tmp.width = smallW;
  tmp.height = smallH;
  const tmpCtx = tmp.getContext("2d");
  if (!tmpCtx) return;
  tmpCtx.drawImage(source, cx, cy, cw, ch, 0, 0, smallW, smallH);

  ctx.imageSmoothingEnabled = false;
  if (!rotationDeg) {
    ctx.drawImage(tmp, 0, 0, smallW, smallH, cx, cy, cw, ch);
  } else {
    // Rotated region — we rotate the mosaic around the rectangle's OWN
    // center, so it matches the overlay's CSS display.
    ctx.save();
    ctx.translate(cx + cw / 2, cy + ch / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(tmp, 0, 0, smallW, smallH, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = true;
}

export function PrivacyBlurEditor({
  open,
  files,
  initialRegions,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  files: File[];
  /** Regions suggested by the moderation check that has already run
   * (privacy_regions) — applied identically to each image.
   * The user can accept them or replace/add/delete them with the pen. */
  initialRegions?: PrivacyRegion[];
  onConfirm: (finalFiles: File[]) => void;
  /** Pressing "×"/Escape/clicking outside — all images remain unconfirmed
   * (an unconfirmed image never goes to upload). */
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const wasOpenRef = useRef(false);

  const [slots, setSlots] = useState<ImageSlot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const current = slots[currentIndex] as ImageSlot | undefined;
  // useMemo: if `current` doesn't exist, `?? []` would create a NEW array
  // on every render — this would needlessly break the reference identity
  // of `render`'s useCallback (below).
  const regions = useMemo(() => current?.regions ?? [], [current]);
  const history = current?.history ?? [[]];
  const historyIndex = current?.historyIndex ?? 0;

  // The container's ACTUAL current size (px) — tracked with a
  // ResizeObserver, not computed once when the image loads. This matters
  // because at the moment the dialog opens (during the zoom-in-95
  // animation) its real size hadn't settled yet — with a previous guess
  // (e.g. 800px) the image could be sized larger than the dialog and
  // appear cropped/overflowing.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  // If measurement hasn't arrived yet (e.g. the first frame of the
  // Dialog portal opening), instead of 0 (= invisible image) we fall
  // back to a gentle default size — the ResizeObserver later replaces it
  // with the real size.
  const dispSize = current?.base
    ? fitContain(
        current.base.width,
        current.base.height,
        containerSize.w || 480,
        containerSize.h || 400,
      )
    : { w: 0, h: 0 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !open) return;
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setContainerSize({ w: el.clientWidth, h: el.clientHeight });
      }
    };
    update();
    // A second measurement one frame later — in case the first (sync)
    // one ran before the Dialog portal's layout was ready.
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [open]);

  // Loads and decodes ALL images at once, when the dialog opens (not
  // lazily, one image at a time) — so the final confirmation always has
  // every image, regardless of whether the user actually visited each of them.
  useEffect(() => {
    // Reset state only at the moment `open` TRANSITIONS to true (tracked
    // with a ref, not a plain `open` in deps) — this syncs with an
    // external prop, it's not "state computed from render".
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (files.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(false);
      setCurrentIndex(0);
      setSelectedId(null);
      // BUG FOUND (user report: "things that should be hidden aren't
      // being hidden"): previously ALL regions (from however many images)
      // were applied identically to EVERY image — image 1's coordinates
      // covered the wrong spot on image 2, leaving the actual number
      // exposed. Now ai-brain assigns each region an `imageIndex` (see
      // supabase/functions/ai-brain) — here, only the regions belonging
      // to that specific image are applied to it.
      Promise.all(
        files.map((file, i) =>
          decodeSlot(
            file,
            initialRegions?.filter((r) => (r.imageIndex ?? 0) === i),
          ),
        ),
      ).then((newSlots) => {
        setSlots(newSlots);
        setReady(true);
      });
    } else if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, files, initialRegions]);

  // The touch-action CSS only sometimes works (especially in iOS Safari)
  // — by listening directly for "touchmove" (passive:false) we guarantee
  // the browser never pinch-zooms the whole PAGE (title, buttons,
  // everything) — not just inside the image itself, since the user's
  // fingers can also land outside it (e.g. on text or a button) and the
  // browser would zoom the entire dialog. Listening at the document
  // level so this holds EVERYWHERE in the dialog, not just on the canvas.
  useEffect(() => {
    if (!open) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", onTouchMove);
  }, [open]);

  // Same issue on desktop: a trackpad pinch or Ctrl+wheel arrives as a
  // "wheel" event with ctrlKey=true — the browser treats it as zooming
  // the whole page. If this happens outside the image itself (e.g. over
  // text or a button), we still prevent it.
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [open]);

  // Renders the canvas: the CURRENT base image + the mosaic fill of each of its regions
  const render = useCallback(() => {
    const base = current?.base;
    const canvas = canvasRef.current;
    if (!base || !canvas) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    for (const r of regions) {
      redactRect(
        base,
        ctx,
        r.x * base.width,
        r.y * base.height,
        r.width * base.width,
        r.height * base.height,
        r.rotation,
      );
    }
  }, [current, regions]);

  useEffect(() => {
    render();
  }, [render]);

  const updateRegions = (updater: EditableRegion[] | ((prev: EditableRegion[]) => EditableRegion[])) => {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s;
        const next = typeof updater === "function" ? (updater as (p: EditableRegion[]) => EditableRegion[])(s.regions) : updater;
        return { ...s, regions: next };
      }),
    );
  };

  const pushHistory = (next: EditableRegion[]) => {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s;
        const trimmed = s.history.slice(0, s.historyIndex + 1);
        const newHistory = [...trimmed, next];
        return { ...s, regions: next, history: newHistory, historyIndex: newHistory.length - 1 };
      }),
    );
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    setSlots((prev) =>
      prev.map((s, i) =>
        i === currentIndex ? { ...s, historyIndex: s.historyIndex - 1, regions: s.history[s.historyIndex - 1] } : s,
      ),
    );
    setSelectedId(null);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setSlots((prev) =>
      prev.map((s, i) =>
        i === currentIndex ? { ...s, historyIndex: s.historyIndex + 1, regions: s.history[s.historyIndex + 1] } : s,
      ),
    );
    setSelectedId(null);
  };

  const goToIndex = (i: number) => {
    if (i < 0 || i >= slots.length) return;
    setCurrentIndex(i);
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
    wrapRef.current?.setPointerCapture?.(e.pointerId);

    if (role === "handle" && regionId) {
      const region = regions.find((r) => r.id === regionId);
      // AI regions are also editable. Previously they were locked — but
      // the model's coordinates can drift, and the user could see the
      // problem but couldn't fix it: the drifted box remained as a
      // useless mosaic while the actual number stayed exposed.
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
    if (role === "rotate" && regionId) {
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      setSelectedId(regionId);
      dragRef.current = {
        kind: "rotate",
        regionId,
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

    // Dragging on empty space — this is always a new "pen" stroke
    // (no addMode needed, dragging is itself the default action). Only a
    // user region is editable and rotatable this way — an AI region
    // always stays locked.
    const id = `region-new-${Date.now()}`;
    const newRegion: EditableRegion = {
      id,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      rotation: 0,
      origin: "user",
    };
    updateRegions((prev) => [...prev, newRegion]);
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
      // We expand the pen's path (not just start→current, but all the
      // points the pen has passed through) — so a curved stroke is also fully covered.
      drag.pathMinX = Math.min(drag.pathMinX!, pos.x);
      drag.pathMinY = Math.min(drag.pathMinY!, pos.y);
      drag.pathMaxX = Math.max(drag.pathMaxX!, pos.x);
      drag.pathMaxY = Math.max(drag.pathMaxY!, pos.y);
      const x = Math.max(0, drag.pathMinX - PEN_PADDING);
      const y = Math.max(0, drag.pathMinY - PEN_PADDING);
      const width = Math.min(1 - x, drag.pathMaxX - drag.pathMinX + PEN_PADDING * 2);
      const height = Math.min(1 - y, drag.pathMaxY - drag.pathMinY + PEN_PADDING * 2);
      updateRegions((prev) => prev.map((r) => (r.id === drag.regionId ? { ...r, x, y, width, height } : r)));
      return;
    }

    if (drag.kind === "rotate") {
      // We compute the angle in real pixel space (not normalized 0-1),
      // so the rotation isn't skewed when the image isn't square.
      const base = current?.base;
      const aspectW = base?.width ?? 1;
      const aspectH = base?.height ?? 1;
      const centerX = drag.startRegion.x + drag.startRegion.width / 2;
      const centerY = drag.startRegion.y + drag.startRegion.height / 2;
      const dxPx = (pos.x - centerX) * aspectW;
      const dyPx = (pos.y - centerY) * aspectH;
      let angleDeg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI + 90;
      angleDeg = ((angleDeg % 360) + 360) % 360;
      updateRegions((prev) => prev.map((r) => (r.id === drag.regionId ? { ...r, rotation: angleDeg } : r)));
      return;
    }

    const dx = pos.x - drag.startPointerX;
    const dy = pos.y - drag.startPointerY;
    updateRegions((prev) =>
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

    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s;
        // A very small drag (an accidental tap without dragging) — we
        // bump it up to the minimum size instead of discarding it, so
        // even a plain tap leaves a visible blur mark.
        const cleaned = s.regions.map((r) => {
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
        const trimmed = s.history.slice(0, s.historyIndex + 1);
        const newHistory = [...trimmed, cleaned];
        return { ...s, regions: cleaned, history: newHistory, historyIndex: newHistory.length - 1 };
      }),
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const next = regions.filter((r) => r.id !== selectedId);
    setSelectedId(null);
    pushHistory(next);
  };

  // Converts each working image (with its mosaics) into a final File.
  const exportSlot = (slot: ImageSlot): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = slot.base!.width;
      canvas.height = slot.base!.height;
      const ctx = canvas.getContext("2d");
      if (!ctx || !slot.base) return reject(new Error("Canvas context missing"));
      ctx.drawImage(slot.base, 0, 0);
      for (const r of slot.regions) {
        redactRect(
          slot.base,
          ctx,
          r.x * slot.base.width,
          r.y * slot.base.height,
          r.width * slot.base.width,
          r.height * slot.base.height,
          r.rotation,
        );
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          resolve(new File([blob], slot.file.name, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        0.92,
      );
    });
  };

  const finalizeAll = async () => {
    if (!ready || slots.length === 0) return;
    const finalFiles = await Promise.all(slots.map(exportSlot));
    onConfirm(finalFiles);
  };

  // On the last image — final confirmation (all images at once). On a
  // non-last image — just moves to the next one.
  const isLastSlot = currentIndex >= slots.length - 1;
  const handleFooterButton = () => {
    if (isLastSlot) {
      finalizeAll();
    } else {
      goToIndex(currentIndex + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl gap-0 flex flex-col max-h-[90dvh]"
      >
        <DialogHeader className="p-6 pb-4 space-y-2 shrink-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("privacyReviewTitle")}
                </DialogTitle>
                {slots.length > 1 && (
                  <span className="shrink-0 text-[10px] font-bold tracking-widest text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded-full px-2 py-0.5">
                    {currentIndex + 1}/{slots.length}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-zinc-400 mt-0.5">
                {t("privacyReviewDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        <div className="px-6 flex-1 min-h-0 flex flex-col overflow-y-auto">
          <div
            ref={wrapRef}
            className="relative w-full select-none rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 touch-none flex items-center justify-center flex-1 min-h-[200px]"
            style={{
              cursor: "crosshair",
            }}
            onPointerDown={handleWrapPointerDown}
            onPointerMove={handleWrapPointerMove}
            onPointerUp={handleWrapPointerUp}
            onPointerCancel={handleWrapPointerUp}
          >
            {!ready ? (
              <div className="w-full aspect-square animate-pulse bg-zinc-200 dark:bg-zinc-700" />
            ) : (
              <div
                style={{
                  width: `${dispSize.w}px`,
                  height: `${dispSize.h}px`,
                  position: "relative",
                }}
              >
                <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
                {regions.map((r) => {
                  const selected = r.id === selectedId;
                  // The dashed border is just an origin marker (AI or pen)
                  // — both kinds are equally movable, resizable, and deletable.
                  const fromAi = r.origin === "ai";
                  return (
                    <div key={r.id}>
                      <div
                        data-role="body"
                        data-region-id={r.id}
                        className={cn(
                          "absolute border-2 cursor-move",
                          fromAi && !selected && "border-dashed",
                          selected
                            ? "border-emerald-500 bg-emerald-500/10"
                            : fromAi
                              ? "border-emerald-400/70 hover:border-emerald-400"
                              : "border-white/80 hover:border-emerald-400",
                        )}
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.width * 100}%`,
                          height: `${r.height * 100}%`,
                          transform: r.rotation ? `rotate(${r.rotation}deg)` : undefined,
                        }}
                      >
                        {selected && (
                          <div
                            data-role="rotate"
                            data-region-id={r.id}
                            className="absolute w-5 h-5 rounded-full bg-white border-2 border-blue-500 shadow-md flex items-center justify-center"
                            style={{
                              left: "50%",
                              top: "-26px",
                              transform: "translateX(-50%)",
                              cursor: "alias",
                            }}
                          >
                            <RotateCw className="w-3 h-3 text-blue-500 pointer-events-none" />
                          </div>
                        )}
                      </div>
                      {selected && (
                        <>
                          {r.rotation === 0 &&
                            (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
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
                            onPointerDown={(e) => e.stopPropagation()}
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
              </div>
            )}

            {/* Navigation between images — only if there is more than one image */}
            {ready && slots.length > 1 && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => goToIndex(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center shadow-md disabled:opacity-30 touch-manipulation"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => goToIndex(currentIndex + 1)}
                  disabled={currentIndex === slots.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center shadow-md disabled:opacity-30 touch-manipulation"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Image dots — direct navigation to each image */}
          {ready && slots.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2.5">
              {slots.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all touch-manipulation",
                    i === currentIndex ? "w-5 bg-emerald-500" : "w-1.5 bg-zinc-300 dark:bg-zinc-700",
                  )}
                />
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-end gap-2 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl touch-manipulation"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl touch-manipulation"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 shrink-0">
          <Button
            type="button"
            onClick={handleFooterButton}
            disabled={!ready}
            className="w-full h-12 rounded-xl font-bold tracking-widest text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
          >
            {isLastSlot ? t("privacyConfirmBtn") : t("next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
