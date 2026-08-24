/**
 * Компоненти корти QR-код (QR Card Component).
 * Ин компонент стикери махсуси JUYO-ро бо истифода аз qr-code-styling месозад.
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

/** Кунҷи собити градиент — ҳамон `GRADIENT_ANGLE`-и native. Тағйирёбанда танҳо ТАҚСИМОТ (bias) аст. */
const GRADIENT_ANGLE = 45;

export interface QRCardSettings {
  qrColor: string;
  bgColor: string;
  borderRadius: "small" | "medium" | "large";
  shadow: "none" | "soft" | "medium";
  hasBorder: boolean;
  pattern: "none" | "subtle";
  // Танзимоти нав
  dotsType?: DotType;
  cornersSquareType?: CornerSquareType;
  cornersDotType?: CornerDotType;
  /**
   * Градиенти МАТН/нуқтаҳо — танҳо дар сатҳи Pro. То 2 ранг: якум =
   * `qrColor`-и муодил, дуюм = ранги иловагӣ. Кунҷҳо ва JUYO ҳамеша
   * `qrColor`-и СОФ мемонанд (на градиент) — хонданро осон нигоҳ медорад.
   */
  gradientColors?: string[] | null;
  /** Тақсими ду ранг. 1 = баробар. Ниг. шарҳи `QrGradient.bias` дар lib/qr-palette.ts. */
  gradientBias?: number;
  /** Градиенти ЗАМИНА — ранги дуюм. Якум ҳамеша `bgColor` аст. */
  bgGradientColor?: string | null;
  bgGradientBias?: number;
}

interface QRCardProps {
  settings: QRCardSettings;
  id: string;
  /**
   * Рамзи кӯтоҳи 6-ҳарфа. Вақте ҳаст, QR ба `/q/<code>` ишора мекунад.
   *
   * Ин на зебоӣ, балки андозаи нуқта аст: суроғаи дароз QR-и 41×41 месозад,
   * кӯтоҳ 29×29 — нуқтаҳо 41% калонтар, бе кам кардани ҳимоя.
   *
   * Агар набошад (миграция ҳанӯз иҷро нашуда), суроғаи дарози кӯҳна
   * истифода мешавад — стикер ҳамеша кор мекунад.
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
    bgGradientColor = null,
    bgGradientBias = 1,
  } = settings;

  /**
   * Ду hex-и градиент → ду stop-и Гарб-даста, ноаён гузаронда шуда ба
   * маркази минтақаи гузариш — `qr-code-styling` танҳо `rotation` (кунҷи
   * ЯГОНА) мегирад, на нуқтаҳои start/end-и native (ниг. `gradientPoints`
   * дар lib/qr-palette.ts). Тақсимот (bias) ба ҷои ҷойивазкунии
   * координатаҳо тавассути ҶОЙИВАЗКУНИИ stop-ҳо дар дохили минтақаи
   * 0..1 тақлид мешавад: `t = 1/(1+bias)` — 0.5 баробар, >0.5 ба ранги
   * ЯКУМ бештар (bias<1), <0.5 ба ранги ДУЮМ бештар (bias>1).
   */
  function biasedStops(bias: number, c1: string, c2: string) {
    const t = 1 / (1 + bias);
    const w = 0.4; // паҳнои минтақаи гузариш — собит, бо чашм чида шуда
    const o1 = Math.max(0, t - w / 2);
    const o2 = Math.min(1, t + w / 2);
    return [
      { offset: o1, color: c1 },
      { offset: o2, color: c2 },
    ];
  }

  /**
   * Ранги нуқтаҳо ва кунҷҳо — ё як ранг, ё градиент.
   *
   * `qr-code-styling` ҳарду калидро якҷоя қабул мекунад, вале агар
   * `gradient` дошта бошад, `color`-ро нодида мегирад. Бинобар ин
   * ҳангоми хомӯш кардани градиент онро САРЕҲАН `undefined` мегузорем —
   * вагарна `update()` қимати кӯҳнаро нигоҳ медорад ва ранги якхела
   * ҳаргиз барнамегардад.
   */
  const hasGradient = !!gradientColors && gradientColors.length >= 2;
  const paint = hasGradient
    ? {
        color: undefined,
        gradient: {
          type: "linear" as const,
          rotation: (GRADIENT_ANGLE * Math.PI) / 180,
          colorStops: biasedStops(gradientBias, gradientColors[0], gradientColors[1]),
        },
      }
    : { color: qrColor, gradient: undefined };

  const bgPaint = bgGradientColor
    ? {
        color: undefined,
        gradient: {
          type: "linear" as const,
          rotation: (GRADIENT_ANGLE * Math.PI) / 180,
          colorStops: biasedStops(bgGradientBias, bgColor, bgGradientColor),
        },
      }
    : { color: bgColor, gradient: undefined };

  /**
   * Чашмакҳои кунҷ ранги СОФ мехоҳанд, на градиент — онҳо аз градиент
   * берунанд, пас ранги якхела дар тамоми се чашмак лозим аст (native
   * ҳамин корро мекунад — ниг. `effQrAccent`/`accent` дар
   * `lib/qr-palette.ts`). Ранги якуми градиент интихоб мешавад.
   */
  const accentPaint = hasGradient
    ? { color: gradientColors[0], gradient: undefined }
    : { color: qrColor, gradient: undefined };

  /**
   * `qr-code-styling` танҳо доираи ХУДИ QR-ро градиент мекунад — падинги
   * гирдогирд ва бэкдропи лавҳачаи JUYO бояд ҳамон градиентро ҷудогона
   * гиранд, вагарна дар канори QR як ХАТИ рангии ногаҳонӣ пайдо мешавад.
   */
  const cardBackground = bgGradientColor
    ? `linear-gradient(135deg, ${bgColor}, ${bgGradientColor})`
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `paint`/`bgPaint`/`accentPaint` объекти нав дар ҳар render аст; вобастагиҳои воқеӣ рангҳоянд
  }, [
    qrUrl,
    qrColor,
    bgColor,
    dotsType,
    cornersSquareType,
    cornersDotType,
    gradientColors,
    gradientBias,
    bgGradientColor,
    bgGradientBias,
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
          // Корт МУРАББАЪ: 246 × 246 = 210 (QR) + 18×2 (падинги ҳар чор
          // тараф баробар) — айнан native-и `QrDesignCard`-и `PAD_TOP =
          // PAD_SIDE = PAD_BOTTOM = 18`. Пештар (майдони матни поёнии
          // нестшуда боқимонда) 8/8/21-и номутаносиб буд бо `scaleX`-и
          // ҷубронӣ — native он ҷубронро низ бардошт (талаби корбар:
          // "12→18", ҳар чор тараф баробар), пас веб ҳам содда шуд.
          "relative flex items-center justify-center p-[18px] size-[246px] transition-all duration-300 overflow-hidden",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-zinc-100 dark:border-zinc-800",
        )}
        style={{ background: cardBackground }}
      >
        <div className="relative z-10 flex items-center justify-center" style={{ background: cardBackground }}>
          <div ref={qrContainerRef} />

          {/* Логотипи JUYO дар маркази QR-код */}
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
                className="text-[20px] font-[900] tracking-[0.1em] block leading-none"
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
