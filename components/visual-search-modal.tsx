import { useState, useRef, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Search, Loader2, Sparkles, Scan, ShieldCheck, Zap } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { ItemService } from "@/lib/services/item-service";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResults: (items: any[]) => void;
  directFile?: File | null;
}

export function VisualSearchModal({ isOpen, onClose, onResults, directFile }: VisualSearchModalProps) {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: any;
    if (isSearching) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => Math.min(prev + 1, 60));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  // Ҳамин ки directFile омад, ҷустуҷӯро оғоз мекунем
  useEffect(() => {
    if (directFile && isOpen) {
      setSelectedImage(directFile);
      setPreviewUrl(URL.createObjectURL(directFile));
      handleSearch(directFile);
    }
  }, [directFile, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      handleSearch(file);
    }
  };

  const handleSearch = async (file: File) => {
    setIsSearching(true);
    setScanProgress(0);
    const startTime = Date.now();
    
    // Аниматсияи прогресс
    const interval = setInterval(() => {
      setScanProgress(prev => (prev < 95 ? prev + Math.random() * 5 : prev));
    }, 300);

    try {
      const results = await ItemService.visualSearch(file);
      
      // Натиҷаро фавран нишон медиҳем (бе таъхири сунъӣ)
      setScanProgress(100);
      
      // Интизории кӯтоҳ танҳо барои анҷоми аниматсия
      await new Promise(resolve => setTimeout(resolve, 400));
      
      onResults(results);
      onClose();
      
      if (results.length > 0) {
        toast.success(t('visualSearchComplete') || "Ҷустуҷӯи визуалӣ ба анҷом расид");
      } else {
        toast.info(t('noItemsFound'));
      }
    } catch (error: any) {
      console.error("Visual Search Error:", error);
      toast.error(t('visualSearchError') || "Хатогӣ ҳангоми ҷустуҷӯи визуалӣ");
      onClose();
    } finally {
      clearInterval(interval);
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSearching && onClose()}>
      <DialogPortal>
        {/* Фони паси модал - муътадил ва шаффоф */}
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content 
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 duration-200 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "border-none bg-transparent shadow-none p-0 overflow-visible"
          )}
        >
          {/* Барои Accessibility (Radix UI) */}
          <DialogHeader className="sr-only">
            <DialogTitle>Visual Search AI Scanning</DialogTitle>
            <DialogDescription>Scanning your image to find matches</DialogDescription>
          </DialogHeader>

          <div className="relative group px-4 sm:px-0">
            {/* Дурахши мулоим дар атрофи контейнер (Glassy Glow) */}
            <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-[32px] blur-sm opacity-50"></div>
            
            <div className={cn(
              "relative rounded-[30px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-700",
              (isSearching || scanProgress === 100) 
                ? (scanProgress === 100 ? "bg-emerald-950/60 backdrop-blur-xl" : "bg-zinc-950/70 backdrop-blur-xl")
                : "bg-zinc-950/90"
            )}>
              {(isSearching || scanProgress === 100) ? (
                <div className="flex flex-col items-center">
                  {/* Қисмати визуализатсияи AI */}
                  <div className="relative w-full aspect-square overflow-hidden">
                    {previewUrl && (
                      <>
                        {/* Blurred background for empty spaces */}
                        <Image 
                          src={previewUrl} 
                          alt="" 
                          fill 
                          className="object-cover blur-3xl opacity-40 scale-110"
                        />
                        <Image 
                          src={previewUrl} 
                          alt="Analyzing" 
                          fill 
                          className={cn(
                            "object-contain transition-opacity duration-700 relative z-10",
                            scanProgress === 100 ? "opacity-40" : "opacity-60"
                          )}
                        />
                      </>
                    )}
                    
                    {/* Сканери лазерӣ */}
                    {scanProgress < 100 && (
                      <div className="absolute inset-0 z-10">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-scan-fast"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent h-1/2 animate-scan-overlay"></div>
                      </div>
                    )}

                    {/* Нуқтаҳои AI (Neural Grid) */}
                    <div 
                      className={cn(
                        "absolute inset-0 transition-opacity duration-700 animate-grid-scan",
                        scanProgress === 100 ? "opacity-40" : "opacity-90"
                      )}
                      style={{
                        backgroundImage: "radial-gradient(rgba(52, 211, 153, 1) 1.5px, transparent 1.5px)",
                        backgroundSize: "25px 25px"
                      }}
                    ></div>

                    {/* Timer & Counter Overlay */}
                    {scanProgress < 100 && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                          {t('ai_steps.seconds_left').replace('%{count}', elapsedSeconds.toString())}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-20 flex items-center justify-center bg-zinc-950">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>

        <style jsx global>{`
          @keyframes scan-fast {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes scan-overlay {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(200%); }
          }
          @keyframes gemini-gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-scan-fast {
            animation: scan-fast 1.5s linear infinite;
          }
          .animate-scan-overlay {
            animation: scan-overlay 2.5s ease-in-out infinite;
          }
          .animate-gemini-gradient {
            animation: gemini-gradient 3s ease infinite;
          }
          @keyframes pulse-data {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 0.8; transform: scale(1.2); }
          }
          @keyframes slow-pan {
            0% { background-position: 0% 0%; }
            100% { background-position: 100% 100%; }
          }
          .animate-pulse-data {
            animation: pulse-data 3s ease-in-out infinite;
          }
          .animate-slow-pan {
            animation: slow-pan 60s linear infinite;
          }
          @keyframes grid-scan {
            0% { background-position: 0% 0%; }
            100% { background-position: 25px 25px; }
          }
          .animate-grid-scan {
            animation: grid-scan 1.5s linear infinite;
          }
        `}</style>
      </DialogPortal>
    </Dialog>
  );
}
