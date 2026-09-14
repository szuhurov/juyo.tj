import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Blue "verified" badge — the admin grants it to real accounts/companies. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("w-4 h-4 shrink-0 text-emerald-500 fill-emerald-500 stroke-white", className)}
      aria-label="Тасдиқшуда"
    />
  );
}
