"use client";

import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSettings, useUpdateAdminSettings } from "@/lib/hooks/use-admin-settings";

export function AiModerationToggle() {
  const { data, isLoading } = useAdminSettings();
  const { mutate, isPending } = useUpdateAdminSettings();
  const enabled = data?.settings?.ai_moderation_enabled ?? true;

  const toggle = () => {
    const next = !enabled;
    mutate(
      { ai_moderation_enabled: next },
      {
        onSuccess: () =>
          toast.success(next ? "AI moderation фаъол шуд" : "AI moderation хомӯш шуд — эълонҳои нав дар интизори тасдиқи дастӣ мемонанд"),
        onError: (err: any) => toast.error(err.message || "Хатогӣ рух дод"),
      },
    );
  };

  if (isLoading) return null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            enabled ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
          )}
        >
          {enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-zinc-900">AI Moderation</h3>
          <p className="text-[11px] font-bold text-zinc-400 truncate">
            {enabled
              ? "Эълонҳои нав худкор бо AI санҷида ва тасдиқ мешаванд"
              : "Хомӯш — эълонҳои нав бе AI, дар ҳолати «дар интизор» нашр мешаванд (танҳо дар профили худи корбар намоён)"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
          enabled ? "bg-emerald-500" : "bg-zinc-300",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            enabled ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
