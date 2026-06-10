import { Skeleton } from "@/components/ui/skeleton";

export default function AddItemLoading() {
  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-24">
      <Skeleton className="h-8 w-48 mb-8" />
      <div className="space-y-5">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
