"use client";

import { useTranslations } from "next-intl";
import { Toaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Themed toaster, always at the top: the bottom edge belongs to the phone
 * tab bar and the pages' sticky action bars (Save, Download PDF). On wider
 * screens it sits below the 56px top nav.
 */
export function AppToaster() {
  const t = useTranslations("UI");
  const tCommon = useTranslations("Common");
  const wide = useMediaQuery("(min-width: 768px)");
  return (
    // A click or tap on a toast's button (Undo, Mark as sent…) leaves focus
    // where it was. Focus taken by the pointer makes sonner hand it back once
    // the toasts are gone, which closes a menu opened in the meantime.
    <div
      className="contents"
      onPointerDownCapture={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) event.preventDefault();
      }}
    >
      <Toaster
        position={wide ? "top-right" : "top-center"}
        richColors
        closeButton
        containerAriaLabel={tCommon("notifications")}
        offset={wide ? { top: 72, right: 24 } : undefined}
        mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        // Replaces (not merges with) components/ui/sonner's toastOptions, so its
        // classNames are repeated here alongside the translated close label.
        toastOptions={{
          closeButtonAriaLabel: t("close"),
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
      />
    </div>
  );
}
