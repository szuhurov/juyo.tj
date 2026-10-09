"use client";

/**
 * Web port of the app's AddPhotoLauncher: tapping Add opens the category
 * sheet over the CURRENT page (the category decides the flow), then — except
 * for Documents/Cards, which never carry a photo (lib/photo-policy.ts) — the
 * photo sheet; /items/add is only opened once that is done.
 * "I don't have a photo" explains that a similar photo from the internet is
 * needed, then opens the gallery (same as the app).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { PhotoSourceSheet } from "@/components/photo-source-sheet";
import { CategorySheet } from "@/components/category-sheet";
import { isNoPhotoCategory } from "@/lib/photo-policy";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/language-context";
import { setPendingAdd } from "@/lib/pending-add-files";

const CameraCaptureModal = dynamic(() =>
  import("@/components/camera-capture-modal").then((m) => m.CameraCaptureModal),
);

const MAX_PHOTOS = 4;

const AddLauncherContext = createContext<{ openAddLauncher: () => void }>({
  openAddLauncher: () => {},
});

export function useAddLauncher() {
  return useContext(AddLauncherContext);
}

export function AddLauncherProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noPhotoOpen, setNoPhotoOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  const openAddLauncher = useCallback(() => setCategoryOpen(true), []);

  const start = (category: string, files: File[]) => {
    setPendingAdd({ category, files: files.slice(0, MAX_PHOTOS) });
    router.push("/items/add");
  };

  const handOver = (files: File[]) => {
    if (files.length === 0 || !categoryRef.current) return;
    start(categoryRef.current, files);
  };

  const pickCategory = (category: string) => {
    setCategoryOpen(false);
    categoryRef.current = category;
    if (isNoPhotoCategory(category)) {
      start(category, []);
      return;
    }
    // The photo sheet opens once the category sheet has closed.
    setTimeout(() => setSheetOpen(true), 300);
  };

  return (
    <AddLauncherContext.Provider value={{ openAddLauncher }}>
      {children}
      <CategorySheet open={categoryOpen} onOpenChange={setCategoryOpen} onPick={pickCategory} />
      <PhotoSourceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCamera={() => setCameraOpen(true)}
        onGallery={() => galleryRef.current?.click()}
        onNoPhoto={() => setNoPhotoOpen(true)}
        centered
      />
      <ConfirmDialog
        open={noPhotoOpen}
        onOpenChange={setNoPhotoOpen}
        icon={ImageOff}
        title={t("addNoPhotoTitle")}
        description={t("addNoPhotoDesc")}
        confirmLabel={t("addNoPhotoConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          setNoPhotoOpen(false);
          galleryRef.current?.click();
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handOver(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {cameraOpen && (
        <CameraCaptureModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            handOver([file]);
          }}
        />
      )}
    </AddLauncherContext.Provider>
  );
}
