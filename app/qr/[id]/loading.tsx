import { Skeleton } from "@/components/ui/skeleton";

export default function QRPageLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 pt-32 pb-12">
        <div className="container mx-auto px-4 text-center flex flex-col items-center">
          <Skeleton className="w-32 h-32 rounded-[2.5rem] mb-6" />
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-32 w-full max-w-md rounded-[2rem] mt-6 mb-10" />
          <Skeleton className="h-16 w-full max-w-xs rounded-2xl mb-4" />
          <Skeleton className="h-14 w-full max-w-xs rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
