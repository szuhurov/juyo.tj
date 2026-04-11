"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkStatus() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "online" | "offline">("idle");

  useEffect(() => {
    // Initial check
    if (!navigator.onLine) {
      setStatus("offline");
    }

    const handleOnline = () => {
      setStatus("online");
      // Hide the green banner after 3 seconds
      const timer = setTimeout(() => {
        setStatus("idle");
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isVisible = status === "online" || status === "offline";
  const isOffline = status === "offline";

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ease-in-out overflow-hidden",
        isVisible ? "h-10" : "h-0"
      )}
    >
      <div
        className={cn(
          "h-full flex items-center justify-center gap-2 px-4 shadow-md transition-colors duration-500",
          isOffline ? "bg-red-600" : "bg-emerald-600"
        )}
      >
        {isOffline ? (
          <WifiOff className="w-4 h-4 animate-pulse text-white" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
        )}
        <span className="text-xs font-black uppercase tracking-widest leading-none text-white">
          {isOffline ? t("noInternet") : t("backOnline")}
        </span>
      </div>
    </div>
  );
}
