"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Аватари даъвогар — бо fallback ба доираи ҳарфи аввал агар URL кор
 * накунад (масалан snapshot-и кӯҳнаи Clerk, ки аллакай 404 медиҳад).
 * className андозаро (масалан w-11 h-11) муайян мекунад — истифода
 * мешавад ба wrapper-и relative, зеро next/image bo fill андозаи
 * падари positioned-ро талаб мекунад.
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
      <div
        className={cn(
          "relative rounded-full overflow-hidden shrink-0 border border-zinc-100 dark:border-zinc-800",
          className,
        )}
      >
        <Image
          src={url}
          alt=""
          fill
          sizes="48px"
          onError={() => setFailed(true)}
          className="object-cover"
        />
      </div>
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
