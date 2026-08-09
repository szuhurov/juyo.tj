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
 *
 * Якчанд акс якҷоя: ҳама аксҳо дар ҳамин ЯК тиреза бо тугмаҳои чап/рост
 * тафтиш мешаванд (на як-як дар тирезаҳои алоҳида) — то корбар озодона
 * байни аксҳо гузарад ва ба акси қаблӣ баргардад, пеш аз тасдиқи ниҳоӣ.
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
  rotation: number; // дараҷа, 0-360 — танҳо барои минтақаҳои "user"
  /** "ai" — пешниҳоди AI, қулфшуда (корбар тағйир дода наметавонад).
   *  "user" — бо қалам кашидашуда, пурра қобили таҳрир ва гардиш. */
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
const AI_REGION_MAX_AREA = 0.25; // Ҳадди ақсои масоҳати як минтақаи AI (аз масоҳати умумии акс) — агар AI хато карда, минтақаи аз ҳад калон дода бошад (масалан қариб тамоми ҳуҷҷат), ба ин андоза кам мешавад.

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function initialRegionsFor(suggested: PrivacyRegion[] | undefined): EditableRegion[] {
  return (suggested ?? []).map((r, i) => {
    let x = Math.max(0, r.x - AI_REGION_PADDING);
    let y = Math.max(0, r.y - AI_REGION_PADDING);
    let width = Math.min(1 - x, r.width + AI_REGION_PADDING * 2);
    let height = Math.min(1 - y, r.height + AI_REGION_PADDING * 2);

    // Агар AI минтақаи хеле калон пешниҳод кунад (масалан аз хатои
    // рамзкушоӣ), онро ба маркази худаш нигоҳ дошта, то ҳадди ақсои
    // масоҳат хурд мекунем — то ҳеҷ гоҳ тамоми ҳуҷҷат пӯшида нашавад.
    if (width * height > AI_REGION_MAX_AREA) {
      const scale = Math.sqrt(AI_REGION_MAX_AREA / (width * height));
      const cx = x + width / 2;
      const cy = y + height / 2;
      width *= scale;
      height *= scale;
      x = clamp01(cx - width / 2);
      y = clamp01(cy - height / 2);
    }

    return { id: `ai-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`, x, y, width, height, rotation: 0, origin: "ai" as const };
  });
}

// Ҳисоби "contain"-fit — акс бояд пурра дар доираи фазои корӣ ҷой шавад,
// на аз паҳно бурида шавад (агар дароз бошад), на аз баландӣ (агар паҳн
// бошад). Ҳамеша аз рӯи андозаи ВОҚЕИИ ҳозираи контейнер ҳисоб мешавад
// (на андозаи тахминӣ дар лаҳзаи боркунии акс — то ҳангоми анимацияи
// кушодани тиреза акс бурида/берун аз тиреза набарояд).
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

// Боркунӣ ва рамзкушоии як акс дар canvas-и корӣ (андозаи маҳдуд барои
// суръат) — минтақаҳо бо пешниҳоди AI (агар бошад) сар мешаванд.
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

// Мозаикаи возеҳ бо блокҳои қатъӣ (канораш тез, на хира) — ҳамон намуде,
// ки бо қалам аввал месохтем. Блокҳо калонтар аз кӯшиши аввал (то 7 ҳуҷра
// дар паҳлӯи кӯтоҳтар) — то ҳеҷ шакли ҳарф/рақам зинда намонад, вале намуди
// "пиксели калон"-и возеҳ (на пахши сиёҳ, на хираи ҳамвор) нигоҳ дошта шавад.
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
    // Минтақаи гардонидашуда — мозаикаро дар атрофи маркази ХУДИ
    // росткунҷа мегардонем, то бо намоиши CSS-и overlay мувофиқ ояд.
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
  /** Минтақаҳои пешниҳодкардаи ҳамон санҷиши moderation-е, ки аллакай
   * иҷро шудааст (privacy_regions) — ба ҳар акс якхела татбиқ мешавад.
   * Корбар метавонад қабул кунад ё бо қалам худаш иваз/илова/нест кунад. */
  initialRegions?: PrivacyRegion[];
  onConfirm: (finalFiles: File[]) => void;
  /** Пахши "×"/Escape/click-и берун — ҳамаи аксҳо бе тасдиқ мемонанд
   * (акси бе тасдиқ ҳаргиз ба upload намеравад). */
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
  // useMemo: агар `current` мавҷуд набошад, `?? []` дар ҳар render як
  // массиви НАВ месозад — ин reference-и `render`-и useCallback (поён)-ро
  // бе сабаб мешиканад.
  const regions = useMemo(() => current?.regions ?? [], [current]);
  const history = current?.history ?? [[]];
  const historyIndex = current?.historyIndex ?? 0;

  // Андозаи ВОҚЕИИ ҳозираи контейнер (px) — бо ResizeObserver пайгирӣ
  // мешавад, на як бор дар лаҳзаи боркунии акс ҳисоб карда мешавад. Ин
  // муҳим аст, зеро дар лаҳзаи кушодани тиреза (ҳангоми анимацияи
  // zoom-in-95) андозаи воқеии он ҳанӯз муқаррар нашуда буд — бо тахмини
  // қаблӣ (масалан 800px) акс метавонист аз тиреза калонтар ҳисоб шавад
  // ва бурида/берун аз он намоён гардад.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  // Агар андозагирӣ ҳанӯз нарасида бошад (масалан фрейми аввали кушодани
  // portal-и Dialog), ба ҷои 0 (= акси нонамоён) андозаи мулоими эҳтиётӣ
  // мегирем — ResizeObserver баъдтар онро бо андозаи воқеӣ иваз мекунад.
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
    // Андозагирии дуюм як фрейм баъд — агар аввалин (синхронӣ) ҳанӯз пеш аз
    // тайёр шудани layout-и portal-и Dialog иҷро шуда бошад.
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [open]);

  // Боркунӣ ва рамзкушоии ҲАМАИ аксҳо якбора, вақте ки тиреза кушода
  // мешавад (на ба таъхир, барои ҳар акс алоҳида) — то тасдиқи ниҳоӣ
  // ҳамеша ҳамаи аксҳоро дошта бошад, новобаста аз он ки корбар воқеан
  // ба ҳар яки онҳо гузаштааст ё не.
  useEffect(() => {
    // Бозоғозии state танҳо дар лаҳзаи ГУЗАРИШИ open → true (бо ref пайгирӣ
    // мешавад, на бо оддии `open` дар deps) — синхронизатсия бо prop-и
    // берунӣ, на "state аз рендер ҳисобшуда".
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (files.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(false);
      setCurrentIndex(0);
      setSelectedId(null);
      Promise.all(files.map((file) => decodeSlot(file, initialRegions))).then((newSlots) => {
        setSlots(newSlots);
        setReady(true);
      });
    } else if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, files, initialRegions]);

  // touch-action CSS-и танҳо баъзан кор мекунад (алалхусус Safari-и iOS) —
  // бо гӯш кардани мустақими "touchmove" (passive:false) кафолат медиҳем,
  // ки браузер ҳаргиз тамоми САҲИФАРО (сарлавҳа, тугмаҳо, ҳама чиз) pinch-
  // zoom накунад — на танҳо дохили худи акс, зеро ангуштони корбар метавонанд
  // берун аз он ҳам расанд (масалан ба матн ё тугма) ва браузер тамоми
  // тирезаро калон кунад. Гӯш дар сатҳи document, то ин ҳолатро дар ҲАР
  // ҷои тиреза дошта бошад, на танҳо дар канвас.
  useEffect(() => {
    if (!open) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", onTouchMove);
  }, [open]);

  // Ҳамон масъала дар desktop: pinch дар trackpad ё Ctrl+ғилдирак ҳамчун
  // "wheel" бо ctrlKey=true меояд — браузер онро zoom-и тамоми саҳифа
  // мешуморад. Агар ин рӯй диҳад берун аз худи акс (масалан болои матн ё
  // тугма), боз ҳам пешгирӣ мекунем.
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [open]);

  // Рендери canvas: акси асосии ҲОЗИРА + пахши хираи ҳар минтақаи он
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
      // AI-и минтақаҳо қулфшуда — корбар онҳоро тағйир дода наметавонад.
      if (!region || region.origin !== "user") return;
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
      if (!region || region.origin !== "user") return;
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
      if (!region || region.origin !== "user") return;
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
    // кашидан худи амали пешфарз аст). Танҳо минтақаи корбар қобили таҳрир
    // ва гардиш аст — минтақаи AI ҳамеша қулф мемонад.
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
      updateRegions((prev) => prev.map((r) => (r.id === drag.regionId ? { ...r, x, y, width, height } : r)));
      return;
    }

    if (drag.kind === "rotate") {
      // Кунҷро дар фазои воқеии пиксел ҳисоб мекунем (на 0-1 нормалӣ), то
      // агар акс мураббаъ набошад, гардиш каҷ нашавад.
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
        // Каши хеле хурд (пахши тасодуфӣ бе кашидан) — ба ҳадди ақал мерасонем,
        // на бекор мекунем, то як tap-и оддӣ низ доғи дидашавандаи блур диҳад.
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

  // Ҳар акси кориро (бо мозаикаҳояш) ба File-и ниҳоӣ табдил медиҳад.
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

  // Дар акси охирин — тасдиқи ниҳоӣ (ҳамаи аксҳо якҷоя). Дар акси
  // ғайри-охирин — танҳо ба акси навбатӣ мегузарад.
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
                <DialogTitle className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t("privacyReviewTitle")}
                </DialogTitle>
                {slots.length > 1 && (
                  <span className="shrink-0 text-[10px] font-black tracking-widest text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
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
            className="relative w-full select-none rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 touch-none flex items-center justify-center flex-1 min-h-[200px]"
            style={{
              cursor: "crosshair",
            }}
            onPointerDown={handleWrapPointerDown}
            onPointerMove={handleWrapPointerMove}
            onPointerUp={handleWrapPointerUp}
            onPointerCancel={handleWrapPointerUp}
          >
            {!ready ? (
              <div className="w-full aspect-square animate-pulse bg-zinc-200 dark:bg-zinc-800" />
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
                  const locked = r.origin === "ai";
                  return (
                    <div key={r.id}>
                      <div
                        data-role={locked ? undefined : "body"}
                        data-region-id={locked ? undefined : r.id}
                        className={cn(
                          "absolute border-2",
                          locked
                            ? "border-dashed border-emerald-400/70 pointer-events-none"
                            : cn(
                                "cursor-move",
                                selected
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : "border-white/80 hover:border-emerald-400",
                              ),
                        )}
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.width * 100}%`,
                          height: `${r.height * 100}%`,
                          transform: r.rotation ? `rotate(${r.rotation}deg)` : undefined,
                        }}
                      >
                        {!locked && selected && (
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
                      {!locked && selected && (
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

            {/* Гузариш байни аксҳо — танҳо агар зиёда аз як акс бошад */}
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

          {/* Нуқтаҳои акс — гузариши мустақим ба ҳар акс */}
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
            className="w-full h-12 rounded-xl font-black tracking-widest text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
          >
            {isLastSlot ? t("privacyConfirmBtn") : t("next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
