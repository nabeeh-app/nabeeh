import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background font-body uppercase tracking-wider",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-ink hover:bg-accent/90 rounded-none h-11 px-6",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none",
        outline:
          "border border-ink/20 bg-transparent hover:bg-surface-sage hover:text-ink rounded-none",
        secondary:
          "bg-ink text-canvas hover:bg-ink-deep rounded-none h-11 px-4",
        ghost: "hover:bg-surface-sage hover:text-ink rounded-none",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        default: "h-11 py-2 px-6",
        sm: "h-11 px-3 rounded-none",
        lg: "h-12 px-8 rounded-none",
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
    ({ className, variant, size, asChild: _asChild, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
