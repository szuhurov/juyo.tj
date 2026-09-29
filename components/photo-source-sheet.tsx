"use client";

/**
 * Web port of the app's PhotoSourceModal (an ActionSheet): Camera / Gallery,
 * plus an optional "I don't have a photo" row.
 */
import { Camera, Image as ImageIcon, ImageOff, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export function PhotoSourceSheet({
  open,
  onOpenChange,
  onCamera,
  onGallery,
  onNoPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCamera: () => void;
  onGallery: () => void;
  /** When set, adds an "I don't have a photo" row under Camera/Gallery. */
  onNoPhoto?: () => void;
}) {
  const { t } = useLanguage();
  const actions: { key: string; label: string; icon: LucideIcon; iconClass: string; onClick: () => void }[] = [
    { key: "camera", label: t("camera"), icon: Camera, iconClass: "bg-blue-600 text-white", onClick: onCamera },
    { key: "gallery", label: t("gallery"), icon: ImageIcon, iconClass: "bg-orange-500 text-white", onClick: onGallery },
  ];
  if (onNoPhoto) {
    actions.push({
      key: "no-photo",
      label: t("addNoPhotoBtn"),
      icon: ImageOff,
      iconClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
      onClick: onNoPhoto,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Phones: bottom sheet like the app. Desktop (md+): centered dialog,
        // without the drag handle (the sheet's first child).
        className="mx-auto w-full max-w-md rounded-t-3xl border-none bg-canvas px-4 pt-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] gap-3 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:pt-6 md:pb-5 md:[&>div:first-child]:hidden"
      >
        <SheetTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("choose_photo_method")}
        </SheetTitle>
        <SheetDescription className="sr-only">{t("choose_photo_method")}</SheetDescription>
        <div className="flex flex-col gap-1">
          {actions.map(({ key, label, icon: Icon, iconClass, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onOpenChange(false);
                onClick();
              }}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-tile transition-colors"
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", iconClass)}>
                <Icon className="size-5" />
              </span>
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
