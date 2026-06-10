import { Skeleton } from "@/components/ui/skeleton";

export default function SafetyItemLoading() {
  return (
    <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
        <Skeleton className="aspect-square w-full rounded-none md:rounded-[32px]" />
        <div className="flex flex-col px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-24 w-full rounded-2xl mb-8" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
