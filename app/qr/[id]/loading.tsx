import { Skeleton } from "@/components/ui/skeleton";

// Same shape as the loaded page (./page.tsx) and the app's qr/[id] skeleton:
// language pill, 96px avatar, name + subtitle, contact rows (min-h-14),
// and the full-width "save contact" button pinned to the bottom.
export default function QRPageLoading() {
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col p-5 sm:p-8" aria-hidden>
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      <div className="flex flex-col items-center text-center shrink-0">
        <Skeleton className="w-24 h-24 rounded-full" />
        <Skeleton className="mt-3 h-5 min-[1084px]:h-6 w-44 rounded" />
        <Skeleton className="mt-1.5 h-3.5 w-32 rounded" />
      </div>

      <div className="flex flex-col gap-2 mt-5 sm:mt-6">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>

      <div className="flex-1" />
      <Skeleton className="shrink-0 h-12 w-full rounded-md" />
    </div>
  );
}
