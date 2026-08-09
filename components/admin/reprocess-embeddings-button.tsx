"use client";

import { toast } from "sonner";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmbeddingsMissingCount, useReprocessEmbeddings } from "@/lib/hooks/use-admin-settings";

export function ReprocessEmbeddingsButton() {
  const { data, isLoading } = useEmbeddingsMissingCount();
  const { mutate, isPending } = useReprocessEmbeddings();
  const missingCount = data?.missingCount ?? 0;

  const handleReprocess = () => {
    mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          result.failed > 0
            ? `${result.processed} акс коркард шуд, ${result.failed} ноком`
            : `${result.processed} акс коркард шуд`,
        ),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  if (isLoading) return null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            missingCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
          )}
        >
          <ImageOff className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-zinc-900">Коркарди embedding-ҳо</h3>
          <p className="text-[11px] font-bold text-zinc-400 truncate">
            {missingCount > 0
              ? `${missingCount} ашё бе embedding — дар ҷустуҷӯи аксӣ пайдо намешаванд`
              : "Ҳамаи ашёҳо embedding доранд"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleReprocess}
        disabled={isPending || missingCount === 0}
        className="shrink-0 h-9 px-4 rounded-xl bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Пур кардан
      </button>
    </div>
  );
}
