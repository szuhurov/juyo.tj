/**
 * Button component.
 * This component is used to build various buttons with different styles.
 */
import * as React from "react" // Imported from React
import { Slot } from "@radix-ui/react-slot" // For composition/slotting
import { cva, type VariantProps } from "class-variance-authority" // For button variants

import { cn } from "@/lib/utils" // This is for CSS classes

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring border border-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-2)] hover:bg-primary/90",
        // JUYO brand lime (#E0FF4F). Opt-in, not the default — swapping every
        // existing `default` Button to brand would silently reskin every
        // screen at once; screens adopt this deliberately in a later phase.
        brand:
          "bg-brand text-brand-foreground shadow-[var(--shadow-2)] hover:bg-brand/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-2)] hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-[var(--shadow-2)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-2)] hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 rounded-[var(--radius-control)] px-3 text-xs",
        lg: "h-11 rounded-[var(--radius-control)] px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
