"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Claimant avatar — falls back to a circle with the first letter if the
 * URL doesn't work (e.g. an old Clerk snapshot that already 404s).
 * className sets the size (e.g. w-11 h-11) — it's applied to the relative
 * wrapper, since next/image with fill requires the positioned parent to
 * have a size.
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
          "relative rounded-full overflow-hidden shrink-0 border border-slate-100 dark:border-zinc-800",
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
        "rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center font-semibold text-slate-400 shrink-0",
        className,
      )}
    >
      {(name || "?").charAt(0)}
    </div>
  );
}
