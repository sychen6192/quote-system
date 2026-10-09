"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { formatHotkey, useIsApplePlatform } from "@/hooks/use-hotkey"

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded border bg-background px-1 font-sans text-[0.7rem] font-medium leading-none text-muted-foreground [&_svg]:size-3",
        className
      )}
      {...props}
    />
  )
)
Kbd.displayName = "Kbd"

const KbdGroup = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("inline-flex items-center gap-1", className)}
    {...props}
  />
)
KbdGroup.displayName = "KbdGroup"

/**
 * A hotkey in the viewer's platform notation: "mod+s" → "⌘S" on Apple
 * devices, "Ctrl+S" elsewhere (and on the server, so expect one re-render).
 */
const KbdHotkey = React.forwardRef<
  HTMLElement,
  Omit<React.HTMLAttributes<HTMLElement>, "children"> & { hotkey: string }
>(({ hotkey, ...props }, ref) => {
  const apple = useIsApplePlatform()
  return (
    <Kbd ref={ref} {...props}>
      {formatHotkey(hotkey, apple)}
    </Kbd>
  )
})
KbdHotkey.displayName = "KbdHotkey"

export { Kbd, KbdGroup, KbdHotkey }
