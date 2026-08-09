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
}

interface QRCardProps {
  settings: QRCardSettings;
  id: string;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

export const QRCard: React.FC<QRCardProps> = ({
  settings,
  id,
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
  } = settings;

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling | null>(null);

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/qr/${id}`;

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
          color: qrColor,
          type: dotsType,
        },
        backgroundOptions: {
          color: bgColor,
        },
        cornersSquareOptions: {
          color: qrColor,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          color: qrColor,
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
          color: qrColor,
          type: dotsType,
        },
        backgroundOptions: {
          color: bgColor,
        },
        cornersSquareOptions: {
          color: qrColor,
          type: cornersSquareType,
        },
        cornersDotOptions: {
          color: qrColor,
          type: cornersDotType,
        },
      });
    }
  }, [qrUrl, qrColor, bgColor, dotsType, cornersSquareType, cornersDotType]);

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
          "relative flex flex-col items-center pt-2 px-2 pb-2 transition-all duration-300 w-fit overflow-hidden",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-zinc-100 dark:border-zinc-800",
        )}
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="relative z-10 flex items-center justify-center"
          style={{ backgroundColor: bgColor }}
        >
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
                style={{ color: qrColor, transform: "translate(0.2mm, 0.2mm)" }}
              >
                JUYO
              </span>
            </div>
          </div>
        </div>

        {text && (
          <div className="relative z-10 text-center px-1 mt-1 max-w-[210px]">
            <p
              className="font-black tracking-widest text-[11px] break-words leading-tight"
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
