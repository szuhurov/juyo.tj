"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  ChevronLeft,
  Info,
  Camera,
  QrCode,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ScanPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isNativeWebView, setIsNativeWebView] = useState(false);
  const [showUnknownQr, setShowUnknownQr] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Тафтиши ин ки оё мо дар WebView ҳастем
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
      setIsNativeWebView(true);
      setIsInitializing(false);
      // Фармон ба React Native барои кушодани сканнери Native
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: "OPEN_NATIVE_SCANNER" })
      );
    }
  }, []);

  const handleBack = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(() => {
        router.back();
      }).catch(() => {
        router.back();
      });
    } else {
      router.back();
    }
  };

  // Оғози танзимоти сканнер
  const startScanner = async (isRetry = false) => {
    if (isNativeWebView) return; // Дар WebView сканнери Вебро оғоз намекунем

    if (isRetry) {
      setError(null);
      setIsInitializing(true);
      setIsScanning(false);
      setIsBlocked(false);
    }

    try {
      // 1. Тафтиши медиа-дастгоҳҳо
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Камера дар ин браузер дастгирӣ намешавад ё пайвастшавии бехатар (HTTPS) лозим аст.");
      }

      // Cleanup previous instance
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
        } catch (e) {}
      }

      // 2. Пеш аз оғоз рӯйхати камераҳоро мепурсем
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        throw new Error("Камера ёфт нашуд. Лутфан боварӣ ҳосил кунед, ки камера фаъол аст.");
      }

      const html5QrCode = new Html5Qrcode("reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // 3. Камераи ақибро интихоб мекунем
      const backCamera = cameras.find(c => 
        c.label.toLowerCase().includes('back') || 
        c.label.toLowerCase().includes('environment') ||
        c.label.toLowerCase().includes('rear')
      ) || cameras[cameras.length - 1];

      await html5QrCode.start(
        backCamera.id,
        config,
        (decodedText) => {
          // Тафтиши ин ки оё QR ба JUYO тааллуқ дорад ё не
          const isJuyoQr = decodedText.includes('juyo.tj/qr/') || 
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decodedText);

          if (!isJuyoQr) {
            html5QrCode.stop().then(() => {
              setIsScanning(false);
              setShowUnknownQr(true);
            }).catch(console.error);
            return;
          }

          html5QrCode.stop().then(() => {
            toast.success(t('qrDetected'));
            if (decodedText.startsWith('http')) {
              window.location.href = decodedText;
            } else {
              router.push(`/qr/${decodedText}`);
            }
          }).catch(console.error);
        },
        () => {} 
      );

      setIsScanning(true);
      setIsInitializing(false);
    } catch (err: any) {
      console.error("Scanner Error:", err);
      let msg = t('cameraError') || "Хатогии камера";
      
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
        msg = "Браузер дастрасиро маҳкам кард. Лутфан аз танзимот иҷозат диҳед.";
        setIsBlocked(true);
      } else if (err.name === "NotFoundError") {
        msg = t('cameraNotFound') || "Камера ёфт нашуд.";
      } else {
        msg = err.message || msg;
      }
      
      setError(msg);
      setIsInitializing(false);
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack}
          className="rounded-full bg-zinc-900/50 hover:bg-zinc-800 text-white border border-zinc-800"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="font-black uppercase tracking-widest text-[10px] text-zinc-400">{t('scannerTitle')}</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Scanner Container */}
        <div className="w-full max-w-sm aspect-square relative rounded-[2.5rem] overflow-hidden border-2 border-zinc-800 bg-zinc-900 shadow-2xl shadow-emerald-500/10">
          {isNativeWebView ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-6 p-8 text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
                <Camera className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-widest text-white">Сканнери Native</p>
                <p className="text-[10px] font-bold text-zinc-500 leading-relaxed">
                  Барномаи мобилӣ камераро барои скан кардани QR-код истифода мебарад.
                </p>
              </div>
              <Button 
                onClick={() => (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: "OPEN_NATIVE_SCANNER" }))}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl"
              >
                Дубора кушодан
              </Button>
            </div>
          ) : (
            <>
              <div id="reader" className="w-full h-full"></div>
              
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-emerald-500/50 rounded-3xl pointer-events-none shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
              </div>
            </>
          )}
          
          {!isNativeWebView && (isInitializing || !isScanning) && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('loading')}</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-6 text-center gap-8 z-20">
              <p className="text-sm sm:text-base font-bold text-zinc-300 leading-relaxed px-8">
                Барои скан кардан иҷозати камера лозим аст
              </p>

              <Button 
                onClick={() => startScanner(true)}
                className="bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest px-12 h-14 rounded-2xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 border-none"
              >
                {t('permissionGrant') || 'Иҷозат додан'}
              </Button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {!error && (
          <div className="text-center space-y-4 max-w-xs px-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Info className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('scannerInstruction')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-8 text-center mt-auto">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
          JUYO SAFETY SYSTEM • 2026
        </p>
      </div>

      {/* Модалка барои QR-коди номаълум */}
      <Dialog open={showUnknownQr} onOpenChange={setShowUnknownQr}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl bg-white dark:bg-zinc-900 outline-none">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              {t('unknownQrTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400 font-bold text-base leading-relaxed">
              {t('unknownQrDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-center">
            <Button 
              onClick={() => {
                setShowUnknownQr(false);
                startScanner(true);
              }}
              className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all active:scale-95"
            >
              {t('confirm') || 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}
