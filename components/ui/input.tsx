import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-full border-0 bg-[var(--bg-2)] px-4 py-1 text-base text-[var(--fg-1)] transition-colors duration-150 ease-anorix outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--fg-4)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
