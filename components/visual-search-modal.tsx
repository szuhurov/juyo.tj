"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, X, Search, Image as ImageIcon } from "lucide-react";
import { ItemService, Item } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { ItemCard } from "./item-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Image from "next/image";

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResults: (items: any[]) => void;
  directFile: File | null;
}

export function VisualSearchModal({ isOpen, onClose, onResults, directFile }: VisualSearchModalProps) {
  const { t } = useLanguage();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (directFile) {
      setSelectedFile(directFile);
      const url = URL.createObjectURL(directFile);
      setPreviewUrl(url);
      handleSearch(directFile);
    }
  }, [directFile]);

  useEffect(() => {
    if (!isOpen) {
      // Тоза кардани маълумот ҳангоми пӯшидан
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedFile(null);
      setResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      handleSearch(file);
    }
  };

  const handleSearch = async (file: File) => {
    setIsSearching(true);
    setResults([]);
    try {
      const searchResults = await ItemService.visualSearch(file);
      setResults(searchResults);
      if (searchResults.length === 0) {
        toast.info(t('noItemsFound'));
      } else {
        toast.success(t('visualSearchComplete'));
      }
    } catch (error) {
      console.error("Visual search error:", error);
      toast.error(t('visualSearchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (item: Item) => {
    onResults([item]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSearching && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-500" />
                {t('visualSearchTitle')}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 font-medium text-xs">
                {t('visualSearchDesc')}
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              disabled={isSearching}
              className="rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row bg-zinc-50/50 dark:bg-zinc-900/50">
          {/* Қисми чап: Боргузорӣ ва Пешнамоиш */}
          <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-800 p-6 flex flex-col gap-4 bg-white dark:bg-zinc-950 shrink-0">
            {!previewUrl ? (
              <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/10 transition-all group">
                <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-500" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">{t('uploadPhoto')}</span>
                <span className="text-[10px] text-zinc-500 mt-2 text-center">{t('maxImages')}</span>
              </label>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg border border-zinc-100 dark:border-zinc-800">
                  <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  {isSearching && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                        <Search className="w-4 h-4 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">{t('analyzing')}</span>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                    setResults([]);
                  }}
                  disabled={isSearching}
                  className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-10"
                >
                  {t('clearResults')}
                </Button>
              </div>
            )}
          </div>

          {/* Қисми рост: Натиҷаҳо */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            {isSearching ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{t('analyzing')}</h3>
                  <p className="text-xs text-zinc-500 font-medium max-w-[240px]">{t('pleaseWait')}</p>
                </div>
              </div>
            ) : results.length > 0 ? (
              <ScrollArea className="flex-1 p-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                  {results.map((item) => (
                    <div key={item.id} onClick={() => handleResultClick(item)} className="cursor-pointer">
                      <ItemCard item={item} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4 text-zinc-400">
                <div className="w-16 h-16 rounded-3xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-2">
                  <Search className="w-8 h-8 opacity-20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase tracking-tight">{t('noItemsFound')}</h3>
                  <p className="text-xs font-medium max-w-[240px]">{t('noItemsSubtitle')}</p>
                </div>
              </div>
            )}
            
            {results.length > 0 && (
              <div className="p-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest text-center shrink-0">
                {results.length} {t('visualSearchResultsTitle')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
