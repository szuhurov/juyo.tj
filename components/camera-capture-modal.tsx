"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    // Бозсозии state ҳангоми пӯшидани модал (isOpen → false) — синхронизатсия
    // бо prop-и берунӣ, на "state, ки аз рендер ҳисоб мешавад".
    if (!isOpen) {
      stopStream();
      setIsReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsReady(true);
      } catch (err) {
        console.error("Camera error:", err);
        setError(t('cameraPermissionDenied') || "Дастрасӣ ба камера дода нашуд");
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // `t` аз useLanguage дар ҳар render objект/функсияи нав аст (мемоизатсия
    // нашудааст) — иловаи он ба deps камераро дар ҳар render аз нав оғоз
    // мекард. Танҳо бояд ҳангоми кушода/пӯшида шудани модал иҷро шавад.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      onClose();
    }, "image/jpeg", 0.9);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-dvh max-w-none max-h-none p-0 border-none bg-black overflow-hidden rounded-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Camera</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center">
          {error ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <Camera className="w-10 h-10 text-red-400" />
              <p className="text-sm font-bold text-white/80">{error}</p>
            </div>
          ) : (
            <>
              {!isReady && (
                <Loader2 className="absolute w-8 h-8 animate-spin text-emerald-500 z-10" />
              )}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </>
          )}

          <button
            onClick={onClose}
            className="absolute z-20 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
            style={{ top: "max(0.75rem, env(safe-area-inset-top))", right: "max(0.75rem, env(safe-area-inset-right))" }}
          >
            <X className="w-5 h-5" />
          </button>

          {isReady && !error && (
            <div
              className="absolute left-0 right-0 flex justify-center z-20"
              style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 transition-transform"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
