/**
 * Visual previews of QR style options (web version — ported from the
 * native `components/QrStyleChips.tsx`).
 *
 * Previously the dot and corner shapes were chosen by TEXT LABEL
 * ("Extra smooth", "Dot") — the user had to open each option one by one
 * and look at the QR to figure out what it was. Here each option SHOWS
 * itself.
 *
 * The geometry math (MINI, roundedPath, Bridge, Piece, EYE_*, OUTER_R,
 * INNER_R) is taken EXACTLY from native — plain browser SVG instead of
 * `react-native-svg`.
 */
"use client";

import { cn } from "@/lib/utils";
import { gradientPoints } from "@/lib/qr-palette";
import type { DotType, CornerSquareType, CornerDotType } from "qr-code-styling";

const MINI = [
  [1, 1, 0, 1, 1],
  [1, 0, 0, 0, 1],
  [0, 0, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
];

const CHIP = 44;
const M = CHIP / MINI.length;

/** Rectangle path with a SEPARATE radius per corner (top-left, top-right, bottom-right, bottom-left). */
function roundedPath(x: number, y: number, w: number, h: number, r: number[]) {
  const [tl, tr, br, bl] = r;
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : "",
    `V${y + h - br}`,
    br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : "",
    `H${x + bl}`,
    bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : "",
    `V${y + tl}`,
    tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "",
    "Z",
  ].join(" ");
}

/** Bridge between two neighboring modules — only for the "connected" (rounded) style. */
function Bridge({ x, y, dir, color }: { x: number; y: number; dir: "h" | "v"; color: string }) {
  const px = x * M;
  const py = y * M;
  return dir === "h" ? (
    <rect x={px + M / 2} y={py} width={M} height={M} fill={color} />
  ) : (
    <rect x={px} y={py + M / 2} width={M} height={M} fill={color} />
  );
}

/**
 * "diamond" was added to the chip preview, but it's NOT passed through
 * to QRCard: `qr-code-styling` (the web library) has NO such type AT ALL
 * (see profile/page.tsx, DOT_TYPES). User request: the chip should show
 * it anyway, even though the actual QR won't differ.
 */
export type ChipDotType = DotType | "diamond";

/** A single module in the given style. */
function Piece({ type, x, y, color }: { type: ChipDotType; x: number; y: number; color: string }) {
  const px = x * M;
  const py = y * M;

  if (type === "dots") {
    return <circle cx={px + M / 2} cy={py + M / 2} r={(M / 2) * 0.82} fill={color} />;
  }
  if (type === "square") {
    return <rect x={px} y={py} width={M} height={M} fill={color} />;
  }
  if (type === "extra-rounded") {
    return <circle cx={px + M / 2} cy={py + M / 2} r={M / 2} fill={color} />;
  }
  if (type === "rounded") {
    const r = M / 2;
    return <rect x={px} y={py} width={M} height={M} rx={r} ry={r} fill={color} />;
  }
  if (type === "diamond") {
    // A square rotated 45° — exactly like native.
    const cx = px + M / 2;
    const cy = py + M / 2;
    const h = M / 2;
    return <path d={`M${cx},${cy - h} L${cx + h},${cy} L${cx},${cy + h} L${cx - h},${cy} Z`} fill={color} />;
  }
  // classy / classy-rounded — two OPPOSITE corners rounded (top-left, bottom-right)
  const r = M * 0.5;
  const arc = type === "classy-rounded" ? r : r * 0.6;
  return <path d={roundedPath(px, py, M, M, [arc, 0, arc, 0])} fill={color} />;
}

export function DotStyleChip({
  type,
  qrColor,
  bgColor,
  gradientStops = null,
  angle = 45,
  bias = 1,
}: {
  type: ChipDotType;
  qrColor: string;
  bgColor: string;
  /** Two colors. When present, the preview picks up the same QR gradient. */
  gradientStops?: string[] | null;
  angle?: number;
  bias?: number;
}) {
  const gid = `chip-${type}`;
  const { start, end } = gradientPoints(angle, bias);
  const stops = gradientStops && gradientStops.length >= 2 ? gradientStops : null;
  const fill = stops ? `url(#${gid})` : qrColor;
  const grid = MINI;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${CHIP} ${CHIP}`}>
      {stops && (
        <defs>
          <linearGradient id={gid} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]}>
            {stops.map((col, i) => (
              <stop key={i} offset={`${i / (stops.length - 1)}`} stopColor={col} />
            ))}
          </linearGradient>
        </defs>
      )}
      <rect x={0} y={0} width={CHIP} height={CHIP} fill={bgColor} />
      {type === "rounded" &&
        grid.flatMap((row, y) =>
          row.flatMap((bit, x) => {
            if (!bit) return [];
            const out = [];
            if (row[x + 1]) out.push(<Bridge key={`h${x}-${y}`} x={x} y={y} dir="h" color={fill} />);
            if (grid[y + 1]?.[x]) out.push(<Bridge key={`v${x}-${y}`} x={x} y={y} dir="v" color={fill} />);
            return out;
          }),
        )}
      {grid.map((row, y) =>
        row.map((bit, x) => (bit ? <Piece key={`${x}-${y}`} type={type} x={x} y={y} color={fill} /> : null)),
      )}
    </svg>
  );
}

/** Corner eye — 7 modules, inner dot. */
const EYE_M = CHIP / 7;
const EYE_INNER = EYE_M * 3;

const INNER_R: Partial<Record<CornerDotType, number>> = {
  square: 0,
  rounded: EYE_INNER * 0.2,
  "extra-rounded": EYE_INNER * 0.35,
  dot: EYE_INNER / 2,
};

/**
 * The "Corner border" preview draws FOUR SEPARATE BRACKETS (like a
 * camera focus frame) instead of a full ring — the user wanted the
 * actual app's look, not what was found in native's `QrStyleChips.tsx`
 * (which uses a full ring there). This geometry was built from an app
 * SCREENSHOT, not from the native source — if the real source is found
 * later, it should be compared against this.
 */
// User request: make it even bigger (enlarged again).
const BRACKET_MARGIN = 3;
const BRACKET_ARM = 19;
const BRACKET_STROKE = 8;
/**
 * User request: "the icons look the same as each other" — the previous
 * radii (0 / 4.5 / 9.1) in a 44px box with a 5px stroke were too close
 * to each other. Now the difference is bigger, and `dot` isn't a
 * bracket shape at all — it's a fully separate circle (see below), like
 * the app screenshot, which shows a clear circle for this type, not a rounded corner.
 */
const BRACKET_R: Partial<Record<CornerSquareType, number>> = {
  square: 0,
  rounded: 6,
  "extra-rounded": BRACKET_ARM,
};

/**
 * Path for one bracket — two arms (horizontal, vertical) joined by an
 * arc of radius `r`. The direction of all four brackets EXACTLY matches
 * `roundedPath` (above) — clockwise — so the `sweep flag` (`0 0 1`) stays
 * consistent everywhere.
 */
function bracketD(corner: "tl" | "tr" | "br" | "bl", r: number) {
  const m = BRACKET_MARGIN;
  const L = BRACKET_ARM;
  const far = CHIP - m;
  switch (corner) {
    case "tl":
      return `M${m},${m + L} L${m},${m + r} A${r},${r} 0 0 1 ${m + r},${m} L${m + L},${m}`;
    case "tr":
      return `M${far - L},${m} L${far - r},${m} A${r},${r} 0 0 1 ${far},${m + r} L${far},${m + L}`;
    case "br":
      return `M${far},${far - L} L${far},${far - r} A${r},${r} 0 0 1 ${far - r},${far} L${far - L},${far}`;
    case "bl":
      return `M${m + L},${far} L${m + r},${far} A${r},${r} 0 0 1 ${m},${far - r} L${m},${far - L}`;
  }
}

/** Eye border — four separate corner brackets (the center is deliberately not drawn). */
export function CornerBorderChip({
  type,
  qrColor,
  bgColor,
}: {
  type: CornerSquareType;
  qrColor: string;
  bgColor: string;
}) {
  if (type === "dot") {
    // A fully separate circle, not a bracket — see the BRACKET_R comment above.
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${CHIP} ${CHIP}`}>
        <rect x={0} y={0} width={CHIP} height={CHIP} fill={bgColor} />
        <circle
          cx={CHIP / 2}
          cy={CHIP / 2}
          r={CHIP / 2 - BRACKET_MARGIN - BRACKET_STROKE / 2}
          fill="none"
          stroke={qrColor}
          strokeWidth={BRACKET_STROKE}
        />
      </svg>
    );
  }

  const r = BRACKET_R[type] ?? 0;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${CHIP} ${CHIP}`}>
      <rect x={0} y={0} width={CHIP} height={CHIP} fill={bgColor} />
      {(["tl", "tr", "br", "bl"] as const).map((corner) => (
        <path
          key={corner}
          d={bracketD(corner, r)}
          fill="none"
          stroke={qrColor}
          strokeWidth={BRACKET_STROKE}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** Eye center — ONLY the inner shape, no ring. */
export function CornerCenterChip({
  type,
  qrColor,
  bgColor,
}: {
  type: CornerDotType;
  qrColor: string;
  bgColor: string;
}) {
  const r = INNER_R[type] ?? 0;
  const side = CHIP - EYE_M * 2;
  const off = (CHIP - side) / 2;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${CHIP} ${CHIP}`}>
      <rect x={0} y={0} width={CHIP} height={CHIP} fill={bgColor} />
      <rect
        x={off}
        y={off}
        width={side}
        height={side}
        rx={(r / EYE_INNER) * side}
        ry={(r / EYE_INNER) * side}
        fill={qrColor}
      />
    </svg>
  );
}

/** A row of selectable chips. */
export function StyleChipRow<T extends string>({
  options,
  value,
  onChange,
  renderChip,
  labelFor,
  chipBg,
  chipMaxWidth,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderChip: (v: T) => React.ReactNode;
  labelFor: (v: T) => string;
  /** The chip's OWN background — needed because the chip isn't square. */
  chipBg?: string;
  /** Max width cap for the chip — without it, chips get too large in a wide column. */
  chipMaxWidth?: number;
}) {
  // `justify-between` — exactly like native (`row: { justifyContent: 'space-between' }`):
  // the chips have a `chipMaxWidth`, so without this they'd just cluster
  // to the left, leaving the right side of the row empty.
  return (
    <div className="flex items-center gap-2 justify-between">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            role="radio"
            aria-checked={active}
            aria-label={labelFor(opt)}
            style={chipMaxWidth != null ? { maxWidth: chipMaxWidth } : undefined}
            className={cn(
              // The border is ALWAYS transparent — native (QrStyleChips.tsx,
              // chipBorder) deliberately uses neither a ring nor a shadow
              // ("designer's request: both looked clunky on a small chip").
              // Selection is shown only by SCALING UP and a checkmark badge.
              // SQUARE CORNERS (rounded-none), not rounded-xl — user
              // request: the chip should look square like a real QR
              // module, not a pill.
              "relative flex-1 aspect-square rounded-none border-2 border-transparent p-0.5 transition-transform",
              active && "scale-[1.12] z-10",
            )}
          >
            <div
              className={cn("w-full h-full rounded-none overflow-hidden", !chipBg && "bg-white dark:bg-zinc-900")}
              style={chipBg ? { backgroundColor: chipBg } : undefined}
            >
              {renderChip(opt)}
            </div>
            {active && (
              <span className="absolute top-0.5 right-0.5 flex items-center justify-center size-3 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-zinc-800">
                <svg viewBox="0 0 24 24" className="size-1.5" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
