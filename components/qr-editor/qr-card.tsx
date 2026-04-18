/**
 * Компоненти корти QR-код (QR Card Component).
 * Ин компонент стикери махсуси JUYO-ро месозад.
 * Стикери тайёрро барои пайваст кардани чизҳои физикӣ бо профили рақамии корбар истифода мебарем.
 */
"use client";

import React from "react"; // Китобхонаи React
import { QRCodeSVG } from "qrcode.react"; // Барои сохтани QR-код
import { cn } from "@/lib/utils"; // Барои кор бо классҳои CSS

// Танзимоти намуди зоҳирии стикер (Settings)
export interface QRCardSettings {
  qrColor: string;      // Ранги QR-код ва матн
  bgColor: string;      // Ранги замина (Background)
  borderRadius: "small" | "medium" | "large"; // Шакли кунҷҳо
  shadow: "none" | "soft" | "medium";         // Сояҳо
  hasBorder: boolean;   // Мавҷудияти чаҳорчӯба
  pattern: "none" | "subtle";
  text: string;         // Матни иловагӣ дар зери код
}

interface QRCardProps {
  settings: QRCardSettings;
  id: string;           // ID-и беназири корбар ё ашё
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

export const QRCard: React.FC<QRCardProps> = ({ settings, id, className, innerRef }) => {
  const { qrColor, bgColor, borderRadius, shadow, hasBorder, pattern, text } = settings;

  // Сохтани URL-и беназир барои скан. 
  // Логика: Ин линк мустақиман ба саҳифаи соҳиби ашё мебарад.
  const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${id}`;

  // Харитаи радиусҳо (Radius Map)
  const radiusMap = {
    small: "rounded-[0.3rem]",
    medium: "rounded-[0.8rem]",
    large: "rounded-[1.5rem]",
  };

  // Харитаи сояҳо (Shadow Map)
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
          "relative flex flex-col items-center pt-4 px-4 pb-2 transition-all duration-300 w-fit overflow-hidden",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-zinc-100 dark:border-zinc-800"
        )}
        style={{ backgroundColor: bgColor }}
      >
        {/* Қисми асосии QR-код */}
        <div className="relative z-10 flex items-center justify-center">
          <QRCodeSVG
            value={qrUrl}
            size={180}
            fgColor={qrColor}
            bgColor={bgColor}
            level="H" // Сатҳи баланди хатогибарорӣ (High Error Correction)
            includeMargin={false}
          />
          
          {/* Логотипи JUYO дар маркази QR-код */}
          <div 
            className="absolute flex items-center justify-center px-1.5 rounded-sm"
            style={{ 
              backgroundColor: bgColor,
              minWidth: '55px',
              height: '24px'
            }}
          >
            <span 
              className="text-[20px] font-[900] tracking-[0.1em] block leading-none" 
              style={{ color: qrColor }}
            >
              JUYO
            </span>
          </div>
        </div>

        {/* Матни ихтиёрии корбар дар зери QR-код (агар бошад) */}
        {text && (
          <div className="relative z-10 text-center px-1 mt-2 max-w-[180px]">
            <p 
              className="font-black uppercase tracking-widest text-[11px] break-words leading-tight"
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
