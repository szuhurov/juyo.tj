import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // bg-canvas = ҳамон заминаи асосии сайт. Пештар `bg-muted` буд, ки
      // аз заминаи нав фарқ мекард ва skeleton-ҳо "ҷудо" ба назар мерасиданд.
      className={cn("animate-pulse rounded-md bg-canvas dark:bg-zinc-800", className)}
      {...props}
    />
  )
}

export { Skeleton }
