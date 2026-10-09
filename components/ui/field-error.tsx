import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Inline validation message. role="alert" so it is announced when it appears;
 * renders nothing when there is no message. Link it to its control with
 * aria-describedby (FormMessage does that for you).
 */
const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  if (children == null || children === false || children === "") return null
  return (
    <p
      ref={ref}
      role="alert"
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  )
})
FieldError.displayName = "FieldError"

export { FieldError }
