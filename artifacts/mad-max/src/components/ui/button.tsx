import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const sizeClass = {
  default: "h-10 px-6 py-2",
  sm: "h-8 rounded-sm px-4 text-xs",
  lg: "h-12 rounded-sm px-8 text-base",
  icon: "h-10 w-10",
}

const variantClass = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  outline: "border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
}

export const buttonVariants = ({
  variant = "default",
  size = "default",
}: Pick<ButtonProps, "variant" | "size"> = {}) =>
  cn(variantClass[variant], sizeClass[size])

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 font-display uppercase tracking-widest",
      variantClass[variant],
      sizeClass[size],
      className,
    )

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
      })
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
