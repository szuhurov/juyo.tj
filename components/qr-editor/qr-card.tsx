"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

export interface QRCardSettings {
  qrColor: string;
  bgColor: string;
  borderRadius: "small" | "medium" | "large";
  shadow: "none" | "soft" | "medium";
  hasBorder: boolean;
  pattern: "none" | "subtle";
  text: string;
}

interface QRCardProps {
  settings: QRCardSettings;
  id: string;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement>;
}

export const QRCard: React.FC<QRCardProps> = ({ settings, id, className, innerRef }) => {
  const { qrColor, bgColor, borderRadius, shadow, hasBorder, pattern, text } = settings;

  const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${id}`;

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
          "relative flex flex-col items-center pt-4 px-4 pb-2 transition-all duration-300 w-fit",
          radiusMap[borderRadius],
          shadowMap[shadow],
          hasBorder && "border-2 border-zinc-100 dark:border-zinc-800"
        )}
        style={{ backgroundColor: bgColor }}
      >
        {/* Pattern Overlay */}
        {pattern === "subtle" && (
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{ 
              backgroundImage: `radial-gradient(${qrColor} 1px, transparent 1px)`,
              backgroundSize: '12px 12px'
            }} 
          />
        )}

        {/* QR Code Area with Integrated Brand Center */}
        <div className="relative z-10 flex items-center justify-center">
          <QRCodeSVG
            value={qrUrl}
            size={180}
            fgColor={qrColor}
            bgColor="transparent"
            level="H"
            includeMargin={false}
          />
          
          {/* JUYO Brand - Even larger and perfectly integrated */}
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

        {/* Text - Under the QR code */}
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
