"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (!isStandalone) return;

    setShouldRender(true);
    setIsVisible(true);

    const hideTimer = setTimeout(() => setIsVisible(false), 1500);
    const removeTimer = setTimeout(() => setShouldRender(false), 2000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500",
        !isVisible && "opacity-0 pointer-events-none"
      )}
    >
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl shadow-zinc-200 border border-zinc-100 bg-white p-2">
          <Image
            src="/juyo-logo.jpg"
            alt="juyo"
            width={96}
            height={96}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="mt-4">
          <span className="text-2xl font-black lowercase tracking-tighter text-zinc-900">
            juyo
          </span>
        </div>
      </div>
    </div>
  );
}
