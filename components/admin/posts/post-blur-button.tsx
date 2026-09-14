"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Loader2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReplacePostImages } from "@/lib/hooks/use-admin-posts";

const PrivacyBlurEditor = dynamic(() =>
  import("@/components/privacy-blur-editor").then((m) => m.PrivacyBlurEditor),
);

/**
 * The "Мозаика кардан" (Pixelate) button — lets the admin manually pixelate
 * sensitive areas in any post (not only when it's first submitted).
 * There's no AI suggestion here (initialRegions=[]) — the admin draws it
 * themselves, since the image already exists in storage.
 */
export function PostBlurButton({ postId, images }: { postId: string; images: { id: string; image_url: string }[] }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { mutate, isPending } = useReplacePostImages(postId);

  const startBlur = async () => {
    if (images.length === 0) {
      toast.error("Ин эълон акс надорад");
      return;
    }
    setLoading(true);
    try {
      const fetched = await Promise.all(
        images.map(async (img) => {
          const res = await fetch(img.image_url);
          const blob = await res.blob();
          return new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
        }),
      );
      setFiles(fetched);
      setOpen(true);
    } catch {
      toast.error("Боргирии аксҳо ноком шуд");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = (finalFiles: File[]) => {
    setOpen(false);
    const replacements = images.map((img, i) => ({ imageId: img.id, oldUrl: img.image_url, file: finalFiles[i] }));
    mutate(replacements, {
      onSuccess: () => toast.success("Аксҳо мозаика ва захира шуданд"),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={startBlur}
        disabled={loading || isPending}
      >
        {loading || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
        Мозаика кардан
      </Button>

      {files && (
        <PrivacyBlurEditor
          open={open}
          files={files}
          initialRegions={[]}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
