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

function ScanOverlay({ size }: { size: number }) {
  const dark = "rgba(0,0,0,0.6)";
  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
      {/* SVG overlay — чоркунҷаи шаффоф дар марказ */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="scan-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x="50%"
              y="50%"
              width={size}
              height={size}
              rx="16"
              fill="black"
              style={{ transform: `translate(-${size / 2}px, -${size / 2}px)` }}
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={dark} mask="url(#scan-mask)" />
      </svg>
      {/* Кунҷҳои сабз */}
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
      </div>
    </div>
  );
}

export default function ScanPage() {
  const { t, locale } = useLanguage();
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

    // Тафтиши статуси иҷозат (Permissions API)
    if (navigator.permissions && (navigator.permissions as any).query) {
      navigator.permissions.query({ name: 'camera' as any })
        .then((status) => {
          if (status.state === 'denied') {
            setIsBlocked(true);
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              startScanner(true);
            } else if (status.state === 'denied') {
              setIsBlocked(true);
              setError("Браузер дастрасиро маҳкам кард. Лутфан аз танзимот иҷозат диҳед.");
            }
          };
        })
        .catch(console.error);
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

      // Фармоиши иҷозати камера пеш аз оғоз (Force permission prompt)
      // Ин кафолат медиҳад, ки браузер равзанаи иҷозатро нишон медиҳад
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Маҷрои санҷиширо мебандем
      } catch (permErr: any) {
        console.error("Permission request error:", permErr);
        if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
          setIsBlocked(true);
          throw new Error("Браузер дастрасиро маҳкам кард. Лутфан аз танзимот иҷозат диҳед.");
        }
        throw permErr;
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
            
            // Илова кардани забон ба URL барои гузариши дуруст
            const targetPath = decodedText.includes('juyo.tj/qr/') 
              ? decodedText.split('juyo.tj')[1] 
              : `/qr/${decodedText}`;
            
            const separator = targetPath.includes('?') ? '&' : '?';
            const finalUrl = `${targetPath}${separator}lang=${locale}`;

            if (decodedText.startsWith('http')) {
              window.location.href = finalUrl;
            } else {
              router.push(finalUrl);
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
      
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied") || err.message?.includes("маҳкам кард")) {
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

  const SCAN_SIZE = 260;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">

      {/* Камера — fullscreen */}
      {!isNativeWebView && !error && (
        <div id="reader" className="absolute inset-0 w-full h-full" />
      )}

      {/* Loader */}
      {!isNativeWebView && (isInitializing || !isScanning) && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('loading')}</p>
        </div>
      )}

      {/* Error / Permission */}
      {(error || isNativeWebView) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-6 text-center gap-8 z-10">
          {isNativeWebView ? (
            <>
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
                <Camera className="w-10 h-10 text-emerald-500" />
              </div>
              <Button
                onClick={() => (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: "OPEN_NATIVE_SCANNER" }))}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl"
              >
                Дубора кушодан
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-zinc-300 leading-relaxed">
                Барои скан кардан иҷозати камера лозим аст
              </p>
              <Button
                onClick={() => startScanner(true)}
                className="bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest px-12 h-14 rounded-2xl active:scale-95 transition-all border-none"
              >
                {t('permissionGrant') || 'Иҷозат додан'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Overlay — чоркунҷаи равшан дар маркaz, атроф торик */}
      {isScanning && (
        <ScanOverlay size={SCAN_SIZE} />
      )}

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-12 pb-4 z-20 bg-gradient-to-b from-black/70 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="font-black uppercase tracking-widest text-[10px] text-white/70">{t('scannerTitle')}</h1>
        <div className="w-10" />
      </div>

      {/* Instruction overlay — поён */}
      {isScanning && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-16 pt-12 z-20 bg-gradient-to-t from-black/70 to-transparent">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 border border-white/10 text-white/70">
            <Info className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('scannerInstruction')}</span>
          </div>
        </div>
      )}

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
              onClick={() => { setShowUnknownQr(false); startScanner(true); }}
              className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all active:scale-95"
            >
              {t('confirm') || 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        #reader { background: transparent !important; border: none !important; }
        #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; position: absolute !important; inset: 0 !important; }
        #reader__scan_region { background: transparent !important; min-height: unset !important; }
        #reader__scan_region > img { display: none !important; }
        #reader__scan_region > div { display: none !important; }
        #reader__dashboard { display: none !important; }
        #reader__header_message { display: none !important; }
      `}</style>
    </div>
  );
}
