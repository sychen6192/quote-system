import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

/**
 * Hidden on screen, read by screen readers. `asChild` hides an existing
 * element instead, e.g. a SheetTitle the design does not show.
 */
const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }
>(({ asChild = false, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "span"
  return <Comp ref={ref} className={cn("sr-only", className)} {...props} />
})
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
