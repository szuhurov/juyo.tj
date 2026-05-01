"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  X, 
  AlertTriangle, 
  Loader2, 
  ChevronLeft,
  Info,
  Camera
} from "lucide-react";
import { toast } from "sonner";

export default function ScanPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        };

        const onScanSuccess = (decodedText: string) => {
          try {
            const url = new URL(decodedText);
            if (url.origin === window.location.origin || url.pathname.includes('/qr/')) {
              html5QrCode.stop().then(() => {
                router.push(url.pathname);
              });
            } else {
              toast.error(t('unknownQrTitle'), { description: t('unknownQrDesc') });
            }
          } catch (e) {
            if (decodedText.length > 20) {
              html5QrCode.stop().then(() => {
                router.push(`/qr/${decodedText}`);
              });
            } else {
              toast.error(t('unknownQrTitle'), { description: t('unknownQrDesc') });
            }
          }
        };

        // Кӯшиши оғози автоматӣ бо камераи ақиб
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          onScanSuccess, 
          () => {} // Игнори хатогиҳои фосилавӣ
        );
        
        setIsScanning(true);
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Scanner start error:", err);
        setError(t('permissionCamera'));
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(e => console.error("Stop error", e));
      }
    };
  }, [router, t]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col pt-12">
      {/* Title only */}
      <div className="text-center mb-8">
        <h1 className="font-black uppercase tracking-widest text-sm">{t('scannerTitle')}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Scanner Container */}
        <div className="w-full max-w-sm aspect-square relative rounded-[2.5rem] overflow-hidden border-2 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          
          {(isInitializing || !isScanning) && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('loading')}</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4">
              <Camera className="w-12 h-12 text-zinc-700" />
              <p className="text-xs font-bold text-zinc-500">{error}</p>
              <Button 
                onClick={() => window.location.reload()}
                className="mt-2 bg-white text-zinc-900 font-black uppercase text-[10px] tracking-widest"
              >
                {t('permissionGrant') || 'Retry'}
              </Button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {!error && (
          <div className="text-center space-y-4 max-w-xs">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Info className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('scannerInstruction')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-8 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
          JUYO SAFETY SYSTEM • 2024
        </p>
      </div>

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
