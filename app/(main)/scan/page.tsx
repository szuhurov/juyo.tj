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

function ScanOverlay({ size }: { size: number }) {
  const dark = "rgba(0,0,0,0.6)";
  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
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
  const [showUnknownQr, setShowUnknownQr] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  const handleBack = () => {
    if (html5QrCodeRef.current?.isScanning) {
      html5QrCodeRef.current.stop().then(() => router.back()).catch(() => router.back());
    } else {
      router.back();
    }
  };

  const cleanup = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (_) {}
      html5QrCodeRef.current = null;
    }
    const el = document.getElementById('reader');
    if (el) el.innerHTML = '';
  };

  const onScanSuccess = (decodedText: string) => {
    const ref = html5QrCodeRef.current;
    if (!ref) return;

    const isJuyoQr =
      decodedText.includes('juyo.tj/qr/') ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decodedText);

    if (!isJuyoQr) {
      ref.stop().then(() => { setIsScanning(false); setShowUnknownQr(true); }).catch(console.error);
      return;
    }

    ref.stop().then(() => {
      toast.success(t('qrDetected'));
      const targetPath = decodedText.includes('juyo.tj/qr/')
        ? decodedText.split('juyo.tj')[1]
        : `/qr/${decodedText}`;
      const sep = targetPath.includes('?') ? '&' : '?';
      const finalUrl = `${targetPath}${sep}lang=${localeRef.current}`;
      if (decodedText.startsWith('http')) window.location.href = finalUrl;
      else router.push(finalUrl);
    }).catch(console.error);
  };

  const runScanner = async () => {
    await cleanup();

    // Trigger Chrome native permission dialog directly
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach(t => t.stop());

    const html5QrCode = new Html5Qrcode("reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    html5QrCodeRef.current = html5QrCode;

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 20, aspectRatio: 1.0 },
      onScanSuccess,
      () => {}
    );
    setIsScanning(true);
    setIsInitializing(false);
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setIsInitializing(false);
      return;
    }
    try {
      await runScanner();
    } catch (err: any) {
      setIsInitializing(false);
      setIsScanning(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsBlocked(true);
        setError("denied");
      } else if (err.name === 'NotFoundError' || err.message === 'notfound') {
        setError("notfound");
      } else {
        setError(err.message || "error");
      }
    }
  };

  const handlePermissionClick = async () => {
    setError(null);
    setIsBlocked(false);
    setIsInitializing(true);
    setIsScanning(false);

    try {
      await runScanner();
    } catch (err: any) {
      setIsInitializing(false);
      setIsScanning(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsBlocked(true);
        setError("denied");
      } else if (err.name === 'NotFoundError' || err.message === 'notfound') {
        setError("notfound");
      } else {
        setError(err.message || "error");
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const SCAN_SIZE = 260;

  const errorMsg = isBlocked || error === "denied"
    ? "Браузер дастрасиро маҳкам кард. Дар танзимоти браузер иҷозати камераро фаъол кунед."
    : error === "notfound"
      ? "Камера ёфт нашуд. Лутфан камераро тафтиш кунед."
      : error === "unsupported"
        ? "Камера дар ин браузер дастгирӣ намешавад."
        : "Барои скан кардан иҷозати камера лозим аст";

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 4999 }}>

      {/* Camera feed — always in DOM when scanning */}
      <div id="reader" className="absolute inset-0 w-full h-full" />

      {/* Loader */}
      {isInitializing && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white gap-4 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('loading')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 text-center gap-8 z-10">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
            <Camera className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-sm font-bold text-zinc-600 leading-relaxed max-w-xs">
            {errorMsg}
          </p>
          {!isBlocked && (
            <Button
              onClick={handlePermissionClick}
              className="bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest px-12 h-14 rounded-2xl active:scale-95 transition-all border-none"
            >
              {t('permissionGrant') || 'Иҷозат додан'}
            </Button>
          )}
        </div>
      )}

      {/* Scan overlay */}
      {isScanning && <ScanOverlay size={SCAN_SIZE} />}

      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-12 pb-4 z-20 ${isScanning ? 'bg-gradient-to-b from-black/70 to-transparent' : 'bg-white border-b border-zinc-100'}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className={`rounded-full border ${isScanning ? 'bg-black/40 hover:bg-black/60 text-white border-white/10' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200'}`}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className={`font-black uppercase tracking-widest text-[10px] ${isScanning ? 'text-white/70' : 'text-zinc-500'}`}>{t('scannerTitle')}</h1>
        <div className="w-10" />
      </div>

      {/* Instruction */}
      {isScanning && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-20 pt-12 z-20 bg-gradient-to-t from-black/70 to-transparent">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 border border-white/10 text-white/70">
            <Info className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('scannerInstruction')}</span>
          </div>
        </div>
      )}

      <Dialog open={showUnknownQr} onOpenChange={setShowUnknownQr}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl bg-white outline-none">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-zinc-900">
              {t('unknownQrTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 font-bold text-base leading-relaxed">
              {t('unknownQrDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-center">
            <Button
              onClick={async () => {
                setShowUnknownQr(false);
                setIsInitializing(true);
                setIsScanning(false);
                try { await runScanner(); } catch (err: any) {
                  setIsInitializing(false);
                  setError(err.message || "error");
                }
              }}
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
