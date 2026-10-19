import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-anorix outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--pill)] text-[var(--pill-ink)] hover:bg-[color-mix(in_srgb,var(--pill)_86%,white)]",
        outline:
          "bg-[var(--pill-soft)] text-[var(--pill-soft-ink)] hover:bg-[color-mix(in_srgb,var(--pill-soft)_82%,var(--ink))]",
        secondary:
          "bg-[var(--pill-soft)] text-[var(--pill-soft-ink)] hover:bg-[color-mix(in_srgb,var(--pill-soft)_82%,var(--ink))]",
        ghost:
          "bg-transparent text-[var(--fg-2)] hover:bg-[var(--row)] hover:text-[var(--fg-1)]",
        destructive:
          "bg-transparent text-[var(--danger)] hover:bg-[var(--row)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
