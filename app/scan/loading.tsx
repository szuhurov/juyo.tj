import { Skeleton } from "@/components/ui/skeleton";

export default function ScanLoading() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
      <Skeleton className="w-64 h-64 rounded-3xl bg-zinc-800" />
      <Skeleton className="h-5 w-40 bg-zinc-800" />
    </div>
  );
}
