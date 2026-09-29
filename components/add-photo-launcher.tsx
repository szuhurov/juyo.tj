"use client";

/**
 * Web port of the app's AddPhotoLauncher: tapping Add opens the photo sheet
 * over the CURRENT page; /items/add is only opened once photos are picked.
 * "I don't have a photo" explains that a similar photo from the internet is
 * needed, then opens the gallery (same as the app).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { PhotoSourceSheet } from "@/components/photo-source-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/language-context";
import { setPendingAddFiles } from "@/lib/pending-add-files";

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noPhotoOpen, setNoPhotoOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  const openAddLauncher = useCallback(() => setSheetOpen(true), []);

  const handOver = (files: File[]) => {
    if (files.length === 0) return;
    setPendingAddFiles(files.slice(0, MAX_PHOTOS));
    router.push("/items/add");
  };

  return (
    <AddLauncherContext.Provider value={{ openAddLauncher }}>
      {children}
      <PhotoSourceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCamera={() => setCameraOpen(true)}
        onGallery={() => galleryRef.current?.click()}
        onNoPhoto={() => setNoPhotoOpen(true)}
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
