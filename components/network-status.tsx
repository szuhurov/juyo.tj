"use client";

/**
 * Network status (NetworkStatus).
 * This component checks the internet connection.
 * If the internet is lost or comes back, it shows a banner at the top of the screen.
 */

import { useEffect, useState } from "react"; // React hooks
import { useLanguage } from "@/lib/language-context"; // For language translation
import { WifiOff } from "lucide-react"; // Internet icon
import { cn } from "@/lib/utils"; // For combining CSS classes

export function NetworkStatus() {
  const { t } = useLanguage();
  // Internet status: idle, online (connected), offline (disconnected)
  const [status, setStatus] = useState<"idle" | "online" | "offline">("idle");

  useEffect(() => {
    // Initial check: reading the navigator's state (a system outside React)
    // and syncing it to state — this is exactly the kind of case an effect is for.
    if (!navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("offline");
    }

    // Logic: when the internet comes back
    const handleOnline = () => {
      setStatus("online");
      // Hide the banner after 3 seconds
      const timer = setTimeout(() => {
        setStatus("idle");
      }, 3000);
      return () => clearTimeout(timer);
    };

    // Logic: when the internet is lost
    const handleOffline = () => {
      if (!window.location.pathname.startsWith("/offline")) {
        window.location.href = "/offline.html";
      }
    };

    // Listeners for network changes
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Clean up listeners when the component unmounts
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isVisible = status === "online" || status === "offline";
  const isOffline = status === "offline";

  return (
    <div
      role="status"
      className={cn(
        "fixed top-0 left-0 right-0 z-[7000] transition-all duration-500 ease-in-out overflow-hidden",
        isVisible ? "h-10" : "h-0"
      )}
    >

      {/* Banner container: red for offline, green for online */}
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
        <span className="text-xs font-medium tracking-widest leading-none text-white">
          {isOffline ? t("noInternet") : t("backOnline")}
        </span>
      </div>
    </div>
  );
}
