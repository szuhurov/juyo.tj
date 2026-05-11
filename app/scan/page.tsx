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

  useEffect(() => {
    let mounted = true;

// Оғози танзимоти сканнер бо параметрҳои TypeScript
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (mounted) {
              html5QrCode.stop().then(() => {
                toast.success(t('qrDetected'));
                // Agar URL boshad
                if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
                  window.location.href = decodedText;
                } else {
                  // ID boshad
                  router.push(`/qr/${decodedText}`);
                }
              }).catch(err => {
                console.error("Failed to stop scanner", err);
              });
            }
          },
          (errorMessage) => {
            // Ignore parse errors as they happen constantly when no QR is in view
          }
        );

        if (mounted) {
          setIsScanning(true);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Scanner error", err);
        if (mounted) {
          setError(t('cameraError') || 'Camera permission denied or camera not found.');
          setIsInitializing(false);
        }
      }
    };

    // Add a slight delay to ensure the DOM element is fully ready before starting
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, [router, t]);

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
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Scanner Container */}
        <div className="w-full max-w-sm aspect-square relative rounded-[2.5rem] overflow-hidden border-2 border-zinc-800 bg-zinc-900 shadow-2xl shadow-emerald-500/10">
          <div id="reader" className="w-full h-full"></div>
          
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-emerald-500/50 rounded-3xl pointer-events-none shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
          </div>
          
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
