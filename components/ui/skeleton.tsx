import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // zinc-200 — на сафед ва на canvas: сафед дар заминаи canvas "холӣ"
      // менамуд, canvas бошад аз замина фарқ намекард. Ин ранг ягона
      // вариантест, ки дар ҳарду ҳолат намоён мемонад.
      className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)}
      {...props}
    />
  )
}

export { Skeleton }
