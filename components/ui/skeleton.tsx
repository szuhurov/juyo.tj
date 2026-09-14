import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // zinc-200 — neither white nor canvas: white looked "empty" against
      // the canvas background, while canvas didn't stand out from the
      // background at all. This color is the only option that stays
      // visible in both cases.
      className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700", className)}
      {...props}
    />
  )
}

export { Skeleton }
