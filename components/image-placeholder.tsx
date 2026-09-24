/**
 * Image placeholder — covers three cases: the listing has NO image, the
 * image FAILED to load (404, network, corrupt file), and the image is
 * STILL LOADING.
 *
 * The third case matters: it's placed as a layer UNDERNEATH, with the
 * image rendering on top of it. Before this, the placeholder was an
 * image alternative, so during loading the image's spot was left as an
 * empty gray rectangle.
 *
 * It's `absolute inset-0` because the image container is `relative`
 * everywhere and gets its height from `aspect-*`.
 */
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-zinc-700",
        className,
      )}
      aria-hidden
    >
      <ImageIcon className="w-10 h-10 min-[1084px]:w-14 min-[1084px]:h-14 text-slate-400 dark:text-zinc-600" />
    </div>
  );
}
