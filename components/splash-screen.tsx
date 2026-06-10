"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Нишон додани сплейш-скрин барои 1.5 сония
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);

    // Нест кардани компонент аз DOM пас аз анҷоми аниматсияи fade-out
    const removeTimer = setTimeout(() => {
      setShouldRender(false);
    }, 2000);

    return () => {
      clearTimeout(timer);
      removeTimer && clearTimeout(removeTimer);
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
      <div className="relative flex flex-col items-center animate-logo-pop">
        {/* Логотипи хурд бо кунҷҳои мулоим */}
        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-zinc-50 bg-white p-2">
          <Image 
            src="/juyo-logo.jpg"
            alt="juyo" 
            width={80} 
            height={80} 
            className="w-full h-full object-contain"
            priority
          />
        </div>
        
        {/* Матни juyo дар поёни логотип */}
        <div className="mt-4">
          <span className="text-xl font-black lowercase tracking-tighter text-zinc-900">
            juyo
          </span>
        </div>
      </div>
    </div>
  );
}
