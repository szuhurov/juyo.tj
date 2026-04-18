"use client";

/**
 * Статуси шабака (NetworkStatus).
 * Ин компонент барои санҷидани интернет хизмат мекунад.
 * Агар интернет гум шавад ё пайдо шавад, дар болои экран хабар медиҳад.
 */

import { useEffect, useState } from "react"; // Хукҳои React
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { toast } from "sonner"; // Барои нишон додани хабарҳо
import { WifiOff } from "lucide-react"; // Иконкаи интернет
import { cn } from "@/lib/utils"; // Барои якҷоя кардани классҳои CSS

export function NetworkStatus() {
  const { t } = useLanguage();
  // Ҳолати интернет: idle (ором), online (пайваст), offline (қатъ)
  const [status, setStatus] = useState<"idle" | "online" | "offline">("idle");

  useEffect(() => {
    // Санҷиши аввалия: агар интернет набошад, статусро офлайн мекунем
    if (!navigator.onLine) {
      setStatus("offline");
    }

    // Логика: Вақте интернет пайдо мешавад
    const handleOnline = () => {
      setStatus("online");
      // Пас аз 3 сония баннерро пинҳон мекунем
      const timer = setTimeout(() => {
        setStatus("idle");
      }, 3000);
      return () => clearTimeout(timer);
    };

    // Логика: Вақте интернет гум мешавад
    const handleOffline = () => {
      setStatus("offline");
    };

    // Слушательҳо (Listeners) барои тағйирёбии шабака
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Тоза кардани слушательҳо ҳангоми нест шудани компонент
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
      {/* Контейнери баннер: сурх барои офлайн, сабз барои онлайн */}
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
