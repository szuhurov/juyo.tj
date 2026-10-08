import { Skeleton } from "@/components/ui/skeleton";

// Shown while Clerk's script loads (it can take a few seconds) — same outline
// as Clerk's <SignIn>/<SignUp> card so the form doesn't jump in.
export function AuthFormSkeleton({ fields = 1 }: { fields?: number }) {
  return (
    <div className="w-full px-8 py-8 flex flex-col items-center" aria-busy="true">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="w-full flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="w-full flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-hairline dark:bg-zinc-800" />
        <Skeleton className="h-3 w-6" />
        <div className="h-px flex-1 bg-hairline dark:bg-zinc-800" />
      </div>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="w-full mb-6">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-52 mt-8" />
    </div>
  );
}
