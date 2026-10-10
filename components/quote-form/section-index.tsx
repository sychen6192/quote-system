// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
// (WizardProgress state model: an untouched section is never shown as done,
// and errors always win.)
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SECTION_IDS, sectionDomId, type SectionId } from "./form-model";
import { SectionStateIcon, useSectionStates } from "./section-card";

/** Scroll spy: the last section whose top has passed just below the sticky index. */
function useCurrentSection(): SectionId {
  const [current, setCurrent] = useState<SectionId>("customer");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let next: SectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(sectionDomId(id));
        if (el && el.getBoundingClientRect().top <= 160) next = id;
      }
      // At the very bottom the last section may never reach the line.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setCurrent(atBottom ? SECTION_IDS[SECTION_IDS.length - 1] : next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return current;
}

export function SectionIndex({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const t = useTranslations("QuoteForm.sections");
  const states = useSectionStates();
  const current = useCurrentSection();

  return (
    // The ground-coloured band hides content scrolling between the top nav
    // and the floating index.
    <nav
      aria-label={t("nav")}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mt-3 hidden bg-ground pb-1 pt-3 md:block print:hidden"
    >
      <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border bg-card/90 p-1 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/75">
        {SECTION_IDS.map((id) => {
          const state = states[id];
          const isCurrent = current === id;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${sectionDomId(id)}`}
                aria-current={isCurrent ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(id);
                }}
                className={cn(
                  "flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCurrent
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  state === "error" && "text-destructive hover:text-destructive"
                )}
              >
                <SectionStateIcon state={state} />
                {t(id)}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
