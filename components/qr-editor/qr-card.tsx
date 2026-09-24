/**
 * QR code card component (QR Card Component).
 * This component builds the custom JUYO sticker using qr-code-styling.
 */ "use client";

import React, { useEffect, useRef } from "react";
import QRCodeStyling, {
  DrawType,
  TypeNumber,
  Mode,
  ErrorCorrectionLevel,
  DotType,
  CornerSquareType,
  CornerDotType,
} from "qr-code-styling";
import { cn } from "@/lib/utils";

/** Default gradient angle — used when `gradientAngle`/`bgGradientAngle` is absent from settings. */
const DEFAULT_GRADIENT_ANGLE = 45;

export interface QRCardSettings {
  qrColor: string;
  bgColor: string;
  borderRadius: "small" | "medium" | "large";
  shadow: "none" | "soft" | "medium";
  hasBorder: boolean;
  pattern: "none" | "subtle";
  // New settings
  dotsType?: DotType;
  cornersSquareType?: CornerSquareType;
  cornersDotType?: CornerDotType;
  /**
   * FOREGROUND/dots gradient — Pro tier only. Up to 2 colors: first =
   * the equivalent `qrColor`, second = the extra color. Corners and JUYO
   * always stay a SOLID `qrColor` (not a gradient) — keeps it easy to read.
   */
  gradientColors?: string[] | null;
  /** Split between the two colors. 1 = equal. See the `QrGradient.bias` comment in lib/qr-palette.ts. */
  gradientBias?: number;
  /**
   * FOREGROUND gradient angle — user request: the "rotate" button should
   * cycle the angle (45°→135°→225°→315°), not swap the colors. Defaults
   * to `DEFAULT_GRADIENT_ANGLE`.
   */
  gradientAngle?: number;
  /** BACKGROUND gradient — the second color. The first is always `bgColor`. */
  bgGradientColor?: string | null;
  bgGradientBias?: number;
  /** BACKGROUND gradient angle — same logic, separate. */
  bgGradientAngle?: number;
}

interface QRCardProps {
  settings: QRCardSettings;
  id: string;
  /**
   * A short 6-character code. When present, the QR points to `/q/<code>`.
   *
   * This isn't about aesthetics, it's about dot size: the long URL
   * produces a 41×41 QR, the short one 29×29 — dots are 41% larger,
   * without reducing error correction.
   *
   * If absent (migration hasn't run yet), the old long URL is used —
   * the sticker always keeps working.
   */
  qrCode?: string | null;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

export const QRCard: React.FC<QRCardProps> = ({
  settings,
  id,
  qrCode,
  className,
  innerRef,
}) => {
  const {
    qrColor,
    bgColor,
    borderRadius,
    shadow,
    hasBorder,
    dotsType = "square",
    cornersSquareType = "square",
    cornersDotType = "square",
    gradientColors = null,
    gradientBias = 1,
    gradientAngle = DEFAULT_GRADIENT_ANGLE,
    bgGradientColor = null,
    bgGradientBias = 1,
    bgGradientAngle = DEFAULT_GRADIENT_ANGLE,
  } = settings;

  /**
   * Two hex colors → two gradient stops, smoothly blended around the
   * center of the transition zone — `qr-code-styling` only takes a
   * `rotation` (a SINGLE angle), not native start/end points (see
   * `gradientPoints` in lib/qr-palette.ts). The split (bias) is
   * simulated, instead of shifting coordinates, by SHIFTING the stops
   * within the 0..1 range: `t = 1/(1+bias)` — 0.5 is equal, >0.5 favors
   * the FIRST color (bias<1), <0.5 favors the SECOND color (bias>1).
   */
  function biasedStops(bias: number, c1: string, c2: string) {
    const t = 1 / (1 + bias);
    const w = 0.4; // width of the transition zone — fixed, chosen by eye
    const o1 = Math.max(0, t - w / 2);
    const o2 = Math.min(1, t + w / 2);
    return [
      { offset: o1, color: c1 },
      { offset: o2, color: c2 },
    ];
  }

  /**
   * Color of the dots and corners — either a solid color or a gradient.
   *
   * `qr-code-styling` accepts both keys together, but ignores `color` if
   * `gradient` is set. So when turning off the gradient we EXPLICITLY
   * set it to `undefined` — otherwise `update()` keeps the old value and
   * the solid color never comes back.
   */
  const hasGradient = !!gradientColors && gradientColors.length >= 2;
  const paint = hasGradient
    ? {
        color: undefined,
        gradient: {
          type: "linear" as const,
          rotation: (gradientAngle * Math.PI) / 180,
          colorStops: biasedStops(gradientBias, gradientColors[0], gradientColors[1]),
        },
      }
    : { color: qrColor, gradient: undefined };

  const bgPaint = bgGradientColor
    ? {
        color: undefined,
        gradient: {
          type: "linear" as const,
          rotation: (bgGradientAngle * Math.PI) / 180,
          colorStops: biasedStops(bgGradientBias, bgColor, bgGradientColor),
        },
      }
    : { color: bgColor, gradient: undefined };

  /**
   * The corner eyes want a SOLID color, not a gradient — they're outside
   * the gradient, so a consistent color is needed across all three eyes
   * (native does the same thing — see `effQrAccent`/`accent` in
   * `lib/qr-palette.ts`). The gradient's first color is used.
   */
  const accentPaint = hasGradient
    ? { color: gradientColors[0], gradient: undefined }
    : { color: qrColor, gradient: undefined };

  /**
   * `qr-code-styling` only applies the gradient within the QR's OWN
   * bounds — the surrounding padding and the JUYO badge backdrop must
   * get the same gradient separately, otherwise a sudden colored LINE
   * appears at the QR's edge.
   */
  const cardBackground = bgGradientColor
    ? `linear-gradient(${bgGradientAngle}deg, ${bgColor}, ${bgGradientColor})`
    : bgColor;

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = qrCode ? `${origin}/q/${qrCode}` : `${origin}/qr/${id}`;

  useEffect(() => {
    if (!qrCodeInstance.current) {
      qrCodeInstance.current = new QRCodeStyling({
        width: 210,
        height: 210,
        type: "svg" as DrawType,
        data: qrUrl,
        margin: 0,
        qrOptions: {
          typeNumber: 0 as TypeNumber,
          mode: "Byte" as Mode,
          errorCorrectionLevel: "H" as ErrorCorrectionLevel,
        },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.4,
          margin: 5,
        },
        dotsOptions: {
          ...paint,
          type: dotsType,
        },
        backgroundOptions: {
          ...bgPaint,
        },
        cornersSquareOptions: {
          ...accentPaint,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          ...accentPaint,
          type: cornersDotType,
        },
      });

      if (qrContainerRef.current) {
        qrCodeInstance.current.append(qrContainerRef.current);
      }
    } else {
      qrCodeInstance.current.update({
        width: 210,
        height: 210,
        data: qrUrl,
        dotsOptions: {
          ...paint,
          type: dotsType,
        },
        backgroundOptions: {
          ...bgPaint,
        },
        cornersSquareOptions: {
          ...accentPaint,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          ...accentPaint,
          type: cornersDotType,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `paint`/`bgPaint`/`accentPaint` are new objects on every render; the real dependencies are the colors
  }, [
    qrUrl,
    qrColor,
    bgColor,
    dotsType,
    cornersSquareType,
    cornersDotType,
    gradientColors,
    gradientBias,
    gradientAngle,
    bgGradientColor,
    bgGradientBias,
    bgGradientAngle,
  ]);

  const radiusMap = {
    small: "rounded-[0.3rem]",
    medium: "rounded-[0.8rem]",
    large: "rounded-[1.5rem]",
  };

  const shadowMap = {
    none: "shadow-none",
    soft: "shadow-lg",
    medium: "shadow-2xl",
  };

  return (
    <div className={cn("inline-block", className)}>
      <div
        ref={innerRef}
        className={cn(
          // The card is SQUARE: 246 × 246 = 210 (QR) + 18×2 (equal
          // padding on all four sides) — exactly matching native's
          // `QrDesignCard` `PAD_TOP = PAD_SIDE = PAD_BOTTOM = 18`.
          // Previously (a leftover from the removed bottom text area) it
          // was an uneven 8/8/21 with a compensating `scaleX` — native
          // removed that compensation too (user request: "12→18", equal
          // on all four sides), so the web version was simplified as well.
          "relative flex items-center justify-center p-[18px] size-[246px] transition-all duration-300 overflow-hidden",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-slate-100 dark:border-zinc-800",
        )}
        style={{ background: cardBackground }}
      >
        <div className="relative z-10 flex items-center justify-center" style={{ background: cardBackground }}>
          <div ref={qrContainerRef} />

          {/* JUYO logo at the center of the QR code */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center justify-center px-1.5 rounded-sm"
              style={{
                backgroundColor: bgColor,
                minWidth: "55px",
                height: "24px",
              }}
            >
              <span
                className="text-[20px] font-bold tracking-[0.1em] block leading-none"
                style={{ color: accentPaint.color, transform: "translate(0.2mm, 0.2mm)" }}
              >
                JUYO
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
