"use client";

/**
 * The first step of a new listing (owner decision 2026-10-07): the category
 * is chosen before anything else, because it decides the rest of the flow —
 * Documents/Cards never ask for a photo (lib/photo-policy.ts). Same look as
 * the camera/gallery sheet (photo-source-sheet.tsx), in two columns.
 * Mirrors app/components/CategorySheet.tsx.
 */
import { useCallback, useRef } from "react";
import { useSheetDrag } from "@/lib/hooks/use-sheet-drag";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/language-context";
import { CATEGORIES } from "@/lib/services/item-service";
import { cn } from "@/lib/utils";

// Owner request: Documents first, Cards second, Other last (the rest keep their order).
const FIRST = ["Documents", "Cards"];
const SHEET_CATEGORIES = [
  ...FIRST.map((n) => CATEGORIES.find((c) => c.name === n)!),
  ...CATEGORIES.filter((c) => !FIRST.includes(c.name) && c.name !== "Other"),
  ...CATEGORIES.filter((c) => c.name === "Other"),
];

export function CategorySheet({
  open,
  onOpenChange,
  onPick,
  selected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (category: string) => void;
  selected?: string | null;
}) {
  const { t } = useLanguage();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);
  useSheetDrag(sheetRef, { open, onDismiss: dismiss });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheetRef}
        side="bottom"
        className="mx-auto w-full max-w-md rounded-t-3xl border-none bg-canvas px-4 pt-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] gap-3 max-md:touch-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:pt-6 md:pb-5 md:[&>div:first-child]:hidden md:animate-[juyo-materialize_300ms_cubic-bezier(0.32,0.72,0,1)]"
      >
        <SheetTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("addChooseCategory")}
        </SheetTitle>
        <SheetDescription className="sr-only">{t("addChooseCategory")}</SheetDescription>
        <div className="grid grid-cols-2 gap-1">
          {SHEET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={selected === cat.name}
              onClick={() => onPick(cat.name)}
              className={cn(
                "pressable flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-tile",
                selected === cat.name && "bg-tile",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-700" aria-hidden>
                {cat.icon}
              </span>
              <span className="truncate text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
                {t(`categories.${cat.id}`)}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
