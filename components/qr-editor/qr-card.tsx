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

export interface QRCardSettings {
  qrColor: string;
  bgColor: string;
  borderRadius: "small" | "medium" | "large";
  shadow: "none" | "soft" | "medium";
  hasBorder: boolean;
  pattern: "none" | "subtle";
  text: string;
  // Танзимоти нав
  dotsType?: DotType;
  cornersSquareType?: CornerSquareType;
  cornersDotType?: CornerDotType;
  /**
   * Градиент — танҳо дар сатҳи Pro.
   *
   * Вақте ҳаст, ба ҷои ранги якхела истифода мешавад: нуқтаҳо ва кунҷҳо
   * аз `qrColor` ба `gradientColor` мегузаранд. Матни поён ҳамон
   * `qrColor`-и якхеларо нигоҳ медорад — градиенти матн хонданро душвор
   * мекунад ва дар веб ба ҳар ҳол `background-clip` талаб мекард.
   */
  gradientColor?: string | null;
  gradientRotation?: number;
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
    text,
    dotsType = "square",
    cornersSquareType = "square",
    cornersDotType = "square",
    gradientColor = null,
    gradientRotation = 45,
  } = settings;

  /**
   * Ранги нуқтаҳо ва кунҷҳо — ё як ранг, ё градиент.
   *
   * `qr-code-styling` ҳарду калидро якҷоя қабул мекунад, вале агар
   * `gradient` дошта бошад, `color`-ро нодида мегирад. Бинобар ин
   * ҳангоми хомӯш кардани градиент онро САРЕҲАН `undefined` мегузорем —
   * вагарна `update()` қимати кӯҳнаро нигоҳ медорад ва ранги якхела
   * ҳаргиз барнамегардад.
   */
  const paint = gradientColor
    ? {
        color: undefined,
        gradient: {
          type: "linear" as const,
          rotation: (gradientRotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: qrColor },
            { offset: 1, color: gradientColor },
          ],
        },
      }
    : { color: qrColor, gradient: undefined };

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
          color: bgColor,
        },
        cornersSquareOptions: {
          ...paint,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          ...paint,
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
          color: bgColor,
        },
        cornersSquareOptions: {
          ...paint,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          ...paint,
          type: cornersDotType,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `paint` объекти нав дар ҳар render аст; вобастагиҳои воқеӣ рангҳоянд
  }, [qrUrl, qrColor, bgColor, dotsType, cornersSquareType, cornersDotType, gradientColor, gradientRotation]);

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
          // Корт МУРАББАЪ: 239 × 239.
          //
          //   бар     = 8 + 223 + 8      = 239
          //   баландӣ = 8 + 210 + 17 (матн) + 4 = 239
          //
          // Боло, чап ва рост 8 доранд (талаби корбар — каме ҳаво), поён 4
          // мемонад: зери QR аллакай банди матн истодааст.
          //
          // Матн ЗЕРИ QR дар ҷараён аст ва танҳо ба баландӣ илова мекунад.
          // Барои мураббаъ мондан на падингро, балки БАРИ QR-ро ҳисоб
          // мекунем: qrW = 210 + 17 + 4 − 8 = 223. Ҳамин ҷойи холии сафеди
          // паҳлӯиро низ бо нақшҳои QR пур мекунад.
          "relative flex flex-col items-center justify-center pt-2 px-2 pb-1 size-[239px] transition-all duration-300 overflow-hidden",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-zinc-100 dark:border-zinc-800",
        )}
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="relative z-10 flex items-center justify-center"
          style={{ backgroundColor: bgColor, width: 223, height: 210 }}
        >
          {/* `qr-code-styling` ҳамеша мураббаъ мекашад (dotSize аз рӯи
              `Math.min` ҳисоб мешавад), бинобар ин васеъкуниро бо `scaleX`
              мекунем. Он танҳо ба ХУДИ QR дода мешавад — лавҳачаи JUYO дар
              поён бародари ин div аст ва бетағйир мемонад. */}
          <div ref={qrContainerRef} style={{ transform: `scaleX(${223 / 210})` }} />

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
                style={{ color: qrColor, transform: "translate(0.2mm, 0.2mm)" }}
              >
                JUYO
              </span>
            </div>
          </div>
        </div>

        {text && (
          <div className="relative z-10 text-center px-1 mt-0.5 max-w-[223px]">
            <p
              className="font-bold tracking-widest text-[12px] break-words leading-[15px]"
              style={{ color: qrColor }}
            >
              {text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
