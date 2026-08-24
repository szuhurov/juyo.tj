/**
 * Намунаҳои визуалии услуби QR (нусхаи веб — ниг. native
 * `components/QrStyleChips.tsx`, ки аз он портатсия шудааст).
 *
 * Пештар шакли нуқтаҳо ва кунҷҳо аз рӯи МАТН интихоб мешуданд («Хеле
 * мулоим», «Нуқта») — корбар маҷбур буд ҳар вариантро як-як кушояд ва
 * ба QR нигоҳ кунад, то бифаҳмад кадомаш чист. Ин ҷо ҳар вариант худашро
 * НИШОН медиҳад.
 *
 * Математикаи геометрӣ (MINI, roundedPath, Bridge, Piece, EYE_*, OUTER_R,
 * INNER_R) АЙНАН аз native гирифта шудааст — SVG-и оддии браузер ба ҷои
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

/** Роҳи росткунҷа бо радиуси ҶУДОГОНАИ ҳар кунҷ (боло-чап, боло-рост, поён-рост, поён-чап). */
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

/** Пул байни ду модули ҳамсоя — танҳо барои услуби «часпида» (rounded). */
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
 * "diamond" ба намунаи чиппа илова карда шуд, вале ба QRCard НЕ гузашта
 * мешавад: `qr-code-styling` (китобхонаи веб) чунин навъро ТАМОМАН
 * НАДОРАД (ниг. profile/page.tsx, DOT_TYPES). Талаби корбар: чиппа нишон
 * диҳад, ҳарчанд QR-и воқеӣ фарқ накунад.
 */
export type ChipDotType = DotType | "diamond";

/** Як модул дар услуби додашуда. */
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
    // Мураббаъи 45°-гардонидашуда — айнан native.
    const cx = px + M / 2;
    const cy = py + M / 2;
    const h = M / 2;
    return <path d={`M${cx},${cy - h} L${cx + h},${cy} L${cx},${cy + h} L${cx - h},${cy} Z`} fill={color} />;
  }
  // classy / classy-rounded — ду кунҷи МУҚОБИЛ гирд (боло-чап, поён-рост)
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
  /** Ду ранг. Вақте ҳаст, намуна ҳамон градиенти QR-ро мегирад. */
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

/** Чашмаки кунҷ — 7 модул, нуқтаи дохилӣ. */
const EYE_M = CHIP / 7;
const EYE_INNER = EYE_M * 3;

const INNER_R: Partial<Record<CornerDotType, number>> = {
  square: 0,
  rounded: EYE_INNER * 0.2,
  "extra-rounded": EYE_INNER * 0.35,
  dot: EYE_INNER / 2,
};

/**
 * Намунаи "Ҳошияи кунҷҳо" на ҳалқаи пурра, балки ЧОР ГӮШАИ ҶУДОГОНА
 * (мисли рамкаи фокуси камера) мекашад — тасвири воқеии app талаби
 * корбар буд, на он чи дар `QrStyleChips.tsx`-и native ёфт шуд (он ҷо
 * ҳалқаи пурра аст). Ин геометрия аз рӯи СКРИНШОТИ app сохта шуд, на аз
 * рӯи манбаи native — агар баъдтар манбаи воқеӣ ёфт шавад, бо он муқоиса
 * кардан лозим.
 */
// Талаби корбар: боз ҳам калонтар (такроран калон карда шуд).
const BRACKET_MARGIN = 3;
const BRACKET_ARM = 19;
const BRACKET_STROKE = 8;
/**
 * Талаби корбар: "иконҳо аз якдигар фарқ намекунад" — радиусҳои қаблӣ
 * (0 / 4.5 / 9.1) дар қуттии 44px бо строки 5px хеле наздик буданд.
 * Акнун фарқ калонтар аст, ва `dot` тамоман ГӮША НЕСТ — доираи пурраи
 * ҷудогона (ниг. поён), мисли скриншоти app, ки барои ин навъ доираи
 * возеҳ нишон медиҳад, на гӯшаи гирд.
 */
const BRACKET_R: Partial<Record<CornerSquareType, number>> = {
  square: 0,
  rounded: 6,
  "extra-rounded": BRACKET_ARM,
};

/**
 * Роҳи як гӯша — ду бозу (уфуқӣ, амудӣ) бо камони пайвасткунандаи
 * радиуси `r`. Самти ҳамаи чор гӯша АЙНАН мутобиқи `roundedPath` (боло)
 * — ба ақрабаки соат — то `sweep flag` (`0 0 1`) дар ҳама ҷо якхела монад.
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

/** Ҳошияи чашмак — чор гӯшаи ҷудогона (маркас қасдан кашида намешавад). */
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
    // Доираи пурраи ҷудогона, на гӯша — ниг. шарҳи BRACKET_R боло.
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

/** Маркази чашмак — ТАНҲО шакли дохилӣ, бе ҳалқа. */
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

/** Як қатори чиппакҳо бо интихоб. */
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
  /** Заминаи ХУДИ чиппа — лозим аст, чунки чиппа мураббаъ нест. */
  chipBg?: string;
  /** Ҳадди боло-и бари чиппа — бе он дар сутуни васеъ чиппаҳо аз ҳад калон мешаванд. */
  chipMaxWidth?: number;
}) {
  // `justify-between` — айнан native (`row: { justifyContent: 'space-between' }`):
  // чиппаҳо `chipMaxWidth` доранд, пас бе он онҳо танҳо чап ҷамъ мешаванд
  // ва фазои рости қатор холӣ мемонад.
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
              // Ҳошия ҲАМЕША шаффоф — native (QrStyleChips.tsx, chipBorder)
              // қасдан на ҳалқа, на соя истифода мебарад ("ҳарду талаби
              // дизайнер: дар чиппаи хурд бадандом менамуданд"). Интихоб
              // танҳо бо КАЛОНШАВӢ (scale) ва бэйҷи чекмарк нишон дода мешавад.
              // ЧОРКУНҶА (rounded-none), на rounded-xl — талаби корбар:
              // чиппа бояд мисли модули воқеии QR мураббаъ бошад, на pill.
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
