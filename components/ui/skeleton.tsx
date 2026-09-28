import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // Same look as the mobile app's skeleton — see `.juyo-skeleton` in globals.css.
      aria-hidden
      className={cn("juyo-skeleton rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
