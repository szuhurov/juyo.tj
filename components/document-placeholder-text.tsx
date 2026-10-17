/**
 * The owner's name (and, for a document, the district/street) written ON the
 * JUYO placeholder image of a Documents/Cards listing — in the blank part of
 * the drawn card, so the listing reads like the document it stands for.
 *
 * The placeholder is a square picture shown either whole (listing page) or
 * cropped top and bottom (feed cards). The square "stage" below sits exactly
 * on the picture in both cases, and everything inside is in percent of it
 * (positions measured on public/placeholders/*.png, 800 × 800).
 */
import { cn } from "@/lib/utils";

export function DocumentPlaceholderText({
  category,
  ownerName,
  address,
  plate,
}: {
  category: string;
  ownerName: string;
  address?: string;
  plate?: string;
}) {
  // Licence plate: the number goes into the empty plate (public/placeholders/plate.png).
  if (category === "LicensePlate") {
    if (!plate) return null;
    return (
      <div className="pointer-events-none absolute left-0 top-1/2 z-10 aspect-square w-full -translate-y-1/2 [container-type:inline-size]">
        <div className="absolute left-[30%] top-[41.25%] flex h-[14.5%] w-[56.5%] items-center justify-center overflow-hidden bg-white">
          <span className="truncate font-mono text-[8.2cqw] font-bold leading-none tracking-[0.04em] text-[#1f2f2a]">{plate}</span>
        </div>
      </div>
    );
  }
  const isCard = category === "Cards";
  const place = isCard ? "" : address ?? "";
  if (!ownerName && !place) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-1/2 z-10 aspect-square w-full -translate-y-1/2 [container-type:inline-size]">
      <div
        className={cn(
          "absolute flex flex-col justify-center overflow-hidden text-[#2f4f46]",
          // Document: over the four drawn text lines (white covers them). Card: the empty area beside the chip.
          isCard ? "left-[36%] top-[48.5%] h-[10.5%] w-[45%]" : "left-[45%] top-[36%] h-[22.5%] w-[36.5%] bg-white",
        )}
      >
        {/* A full name (admin listings) is longer than "Name S.": smaller, on two lines. */}
        {ownerName && (
          <span className={cn("font-bold", ownerName.length > 12 ? "line-clamp-2 text-[3.7cqw] leading-[1.2]" : "truncate text-[4.7cqw] leading-[1.25]")}>
            {ownerName}
          </span>
        )}
        {place && <span className="line-clamp-2 text-[3.3cqw] font-semibold leading-[1.25] text-[#5f7d74]">{place}</span>}
      </div>
    </div>
  );
}
