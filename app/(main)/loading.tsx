import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-[86px] md:pt-[65px]">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-square w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
