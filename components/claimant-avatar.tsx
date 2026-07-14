"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Аватари даъвогар — бо fallback ба доираи ҳарфи аввал агар URL кор
 * накунад (масалан snapshot-и кӯҳнаи Clerk, ки аллакай 404 медиҳад).
 */
export function ClaimantAvatar({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className={cn(
          "rounded-full object-cover shrink-0 border border-zinc-100 dark:border-zinc-800",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-400 shrink-0",
        className,
      )}
    >
      {(name || "?").charAt(0)}
    </div>
  );
}
