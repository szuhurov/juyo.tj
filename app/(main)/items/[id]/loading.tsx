import { Skeleton } from "@/components/ui/skeleton";

export default function ItemDetailsLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 mx-auto max-w-6xl md:pt-8 md:px-4 -mb-20 pb-20 md:mb-0 md:pb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
        <div className="sticky top-0 md:top-24 z-0 w-full p-0">
          <Skeleton className="aspect-square w-full rounded-none md:rounded-[32px]" />
        </div>
        <div className="flex flex-col bg-white dark:bg-zinc-950 rounded-t-3xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-24 w-full rounded-2xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
