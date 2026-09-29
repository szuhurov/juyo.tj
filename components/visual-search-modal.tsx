import { useState, useEffect } from "react";
import type { Item } from "@/lib/services/item-service";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-context";
import { ItemService } from "@/lib/services/item-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VisualSearchScanUI } from "@/components/visual-search-scan-ui";

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResults: (items: Item[]) => void;
  directFile?: File | null;
}

export function VisualSearchModal({ isOpen, onClose, onResults, directFile }: VisualSearchModalProps) {
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isSearching) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => Math.min(prev + 1, 60));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  const handleSearch = async (file: File) => {
    setIsSearching(true);

    try {
      const results = await ItemService.visualSearch(file);

      onResults(results);
      onClose();

      if (results.length > 0) {
        toast.success(t('visualSearchComplete') || "Ҷустуҷӯи визуалӣ ба анҷом расид");
      } else {
        toast.info(t('noItemsFound'));
      }
    } catch (error: unknown) {
      console.error("Visual Search Error:", error);
      toast.error(t('visualSearchError') || "Хатогӣ ҳангоми ҷустуҷӯи визуалӣ");
      onClose();
    } finally {
      setIsSearching(false);
    }
  };

  // As soon as directFile arrives, start the search. `handleSearch` is not
  // added to the deps — it relies on the parent's `t`/`onResults`/`onClose`,
  // which are not memoized (they get a new reference on every render), so
  // adding it would cause the search to repeat on every render.
  useEffect(() => {
    if (directFile && isOpen) {
      setPreviewUrl(URL.createObjectURL(directFile));
      handleSearch(directFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directFile, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSearching && onClose()}>
      <DialogPortal>
        {/* Background behind the modal - subtle and transparent */}
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 outline-none",
            "border-none bg-transparent shadow-none p-0 overflow-visible"
          )}
        >
          {/* For Accessibility (Radix UI) */}
          <DialogHeader className="sr-only">
            <DialogTitle>Visual Search AI Scanning</DialogTitle>
            <DialogDescription>Scanning your image to find matches</DialogDescription>
          </DialogHeader>

          {/* Same scan screen as the app (VisualSearchScanUI): ring + photo + steps. */}
          {/* Ring also capped by viewport height, so the card never touches the top/bottom edges. */}
          <div className="mx-4 sm:mx-0 max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl bg-canvas px-5 py-6 shadow-[var(--shadow-3)]">
            <VisualSearchScanUI
              photoUrl={previewUrl}
              size="min(calc(100vw - 120px), 220px, 30dvh)"
              footer={
                <p className="mt-4 text-xs font-medium text-muted-foreground tabular-nums">
                  {t('ai_steps.seconds_left').replace('%{count}', elapsedSeconds.toString())}
                </p>
              }
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
