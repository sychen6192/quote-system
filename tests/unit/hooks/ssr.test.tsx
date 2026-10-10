import { renderToString } from "react-dom/server";

import { useIsDesktop } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useFitScale } from "@/hooks/use-fit-scale";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { KbdHotkey } from "@/components/ui/kbd";
import { FieldError } from "@/components/ui/field-error";

// Server render = what the client must produce during hydration.
function Probe() {
  const desktop = useIsDesktop();
  const mounted = useMounted();
  const online = useOnlineStatus();
  const { scale, scaledHeight, ready } = useFitScale();
  const debounced = useDebouncedValue("v", 300);
  return (
    <p>
      {JSON.stringify({ desktop, mounted, online, scale, scaledHeight, ready, debounced })}
    </p>
  );
}

describe("hooks on the server", () => {
  it("return hydration-safe defaults", () => {
    const html = renderToString(<Probe />).replace(/&quot;/g, '"');
    expect(JSON.parse(html.replace(/^<p>|<\/p>$/g, ""))).toEqual({
      desktop: false,
      mounted: false,
      online: true,
      scale: 1,
      ready: false,
      debounced: "v",
    });
  });
});

describe("primitives on the server", () => {
  it("KbdHotkey renders the non-Apple form", () => {
    expect(renderToString(<KbdHotkey hotkey="mod+s" />)).toContain(">Ctrl+S</kbd>");
  });

  it("FieldError announces and renders nothing when empty", () => {
    expect(renderToString(<FieldError>Required</FieldError>)).toContain('role="alert"');
    expect(renderToString(<FieldError>{""}</FieldError>)).toBe("");
    expect(renderToString(<FieldError />)).toBe("");
  });
});
