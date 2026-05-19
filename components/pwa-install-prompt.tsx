"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function PWAInstallPrompt() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Тафтиши iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Тафтиши ин ки оё барнома аллакай насб шудааст ё дар ҳолати standalone кор мекунад
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Тафтиши ин ки оё корбар ба наздикӣ пешниҳодро рад карда буд
    const dismissedAt = localStorage.getItem('pwa-prompt-dismissed-at');
    if (dismissedAt) {
      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;
      if (now - parseInt(dismissedAt) < fifteenMinutes) {
        return;
      }
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Пешгирӣ аз нишон додани баннери автоматии браузер
      e.preventDefault();
      // Захира кардани ҳодиса барои истифодаи баъдӣ
      setDeferredPrompt(e);
      // Нишон додани баннери мо пас аз чанд сония
      setTimeout(() => {
        setIsVisible(true);
      }, 3000);
    };

    // Барои iOS мо худамон пас аз 3 сония нишон медиҳем, чунки 'beforeinstallprompt' кор намекунад
    if (isIOSDevice && !isStandalone) {
      setTimeout(() => {
        setIsVisible(true);
      }, 3000);
    }

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Барои iOS мо танҳо огоҳӣ медиҳем, ки чӣ тавр насб кунад
      alert(
        t('language') === 'tg' 
          ? 'Барои насб: тугмаи "Поделиться" (Share)-ро пахш кунед ва "На экран «Домой»" (Add to Home Screen)-ро интихоб намоед.'
          : 'To install: tap the "Share" button and select "Add to Home Screen".'
      );
      return;
    }

    if (!deferredPrompt) return;

    // Нишон додани равзанаи насби браузер
    deferredPrompt.prompt();

    // Интизори ҷавоби корбар
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // Cleanup
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Захира кардани вақти радкунӣ, то пас аз 15 дақиқа дубора пайдо шавад
    localStorage.setItem('pwa-prompt-dismissed-at', Date.now().toString());
  };

  if (isInstalled || !isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-zinc-900 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 rounded-3xl p-4 flex items-center gap-4 backdrop-blur-xl">
        {/* Логотип бе хатҳои сафеди иловагӣ */}
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-lg border-none bg-white relative">
          <Image src="/logo.png" alt="juyo" width={48} height={48} className="w-full h-full object-contain p-1" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[14px] tracking-tight mb-0.5 lowercase">
            {t('pwa.title')}
          </p>
          {/* Матни пурра барои тавсиф */}
          <p className="text-zinc-400 font-bold text-[10px] leading-tight uppercase">
            {t('pwa.desc')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            onClick={handleInstallClick}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[9px] tracking-widest px-4 h-10 rounded-xl active:scale-95 transition-all border-none animate-pulse-slow"
          >
            {t('pwa.install')}
          </Button>
          <button 
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.2);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
