import {
  formatHotkey,
  isApplePlatform,
  isComposing,
  isEditableTarget,
  matchesHotkey,
  parseHotkey,
  type HotkeyEvent,
} from "@/hooks/use-hotkey";

function key(
  k: string,
  mods: Partial<Omit<HotkeyEvent, "key" | "code">> & { code?: string } = {}
): HotkeyEvent {
  return {
    key: k,
    code: mods.code ?? (/^[a-z]$/i.test(k) ? `Key${k.toUpperCase()}` : ""),
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    shiftKey: mods.shiftKey ?? false,
  };
}

describe("parseHotkey", () => {
  it("parses modifiers and the key, case-insensitively", () => {
    expect(parseHotkey("Mod+Shift+S")).toEqual({
      key: "s",
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
    });
  });

  it("accepts aliases", () => {
    expect(parseHotkey("esc").key).toBe("escape");
    expect(parseHotkey("cmd+space")).toMatchObject({ key: " ", meta: true });
    expect(parseHotkey("option+up")).toMatchObject({ key: "arrowup", alt: true });
    expect(parseHotkey("control+return")).toMatchObject({ key: "enter", ctrl: true });
  });

  it("handles the + key itself", () => {
    expect(parseHotkey("ctrl++")).toMatchObject({ key: "+", ctrl: true });
    expect(parseHotkey("+").key).toBe("+");
  });

  it("rejects combos without exactly one key", () => {
    expect(() => parseHotkey("")).toThrow();
    expect(() => parseHotkey("mod+shift")).toThrow();
    expect(() => parseHotkey("a+b")).toThrow();
  });
});

describe("matchesHotkey", () => {
  it("mod is Ctrl off Apple and ⌘ on Apple", () => {
    expect(matchesHotkey(key("s", { ctrlKey: true }), "mod+s", false)).toBe(true);
    expect(matchesHotkey(key("s", { metaKey: true }), "mod+s", false)).toBe(false);
    expect(matchesHotkey(key("s", { metaKey: true }), "mod+s", true)).toBe(true);
    expect(matchesHotkey(key("s", { ctrlKey: true }), "mod+s", true)).toBe(false);
  });

  it("requires modifiers to match exactly", () => {
    expect(
      matchesHotkey(key("S", { ctrlKey: true, shiftKey: true }), "mod+s")
    ).toBe(false);
    expect(
      matchesHotkey(key("S", { ctrlKey: true, shiftKey: true }), "mod+shift+s")
    ).toBe(true);
    expect(matchesHotkey(key("s", { ctrlKey: true, altKey: true }), "mod+s")).toBe(
      false
    );
    expect(matchesHotkey(key("s"), "mod+s")).toBe(false);
  });

  it("ignores Shift for punctuation that implies it", () => {
    expect(matchesHotkey(key("?", { shiftKey: true }), "?")).toBe(true);
    expect(matchesHotkey(key("/"), "/")).toBe(true);
    expect(matchesHotkey(key("?", { shiftKey: true }), "shift+?")).toBe(true);
  });

  it("matches named keys", () => {
    expect(matchesHotkey(key("Escape"), "esc")).toBe(true);
    expect(matchesHotkey(key("Enter", { ctrlKey: true }), "mod+enter")).toBe(true);
    expect(matchesHotkey(key(" ", { shiftKey: true }), "space")).toBe(false);
  });

  it("falls back to the physical key when Option/Alt or a non-Latin layout changes the character", () => {
    expect(
      matchesHotkey(key("ß", { altKey: true, code: "KeyS" }), "alt+s", true)
    ).toBe(true);
    expect(
      matchesHotkey(key("ы", { ctrlKey: true, code: "KeyS" }), "mod+s", false)
    ).toBe(true);
    expect(
      matchesHotkey(key("¡", { altKey: true, code: "Digit1" }), "alt+1")
    ).toBe(true);
  });

  it("does not use the physical key when the layout produced a real letter (AZERTY)", () => {
    // AZERTY: the key at QWERTY "A" types "q".
    expect(
      matchesHotkey(key("q", { ctrlKey: true, code: "KeyA" }), "mod+a")
    ).toBe(false);
    expect(
      matchesHotkey(key("q", { ctrlKey: true, code: "KeyA" }), "mod+q")
    ).toBe(true);
  });
});

describe("isComposing", () => {
  it("is true during IME composition (Zhuyin, Pinyin)", () => {
    expect(isComposing({ isComposing: true, keyCode: 83 })).toBe(true);
    expect(isComposing({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isComposing({ isComposing: false, keyCode: 83 })).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("detects text inputs, textareas, selects and contenteditable", () => {
    expect(isEditableTarget({ tagName: "INPUT", type: "text" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT", type: "" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "input", type: "number" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(
      isEditableTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)
    ).toBe(true);
  });

  it("ignores buttons, checkboxes and non-elements", () => {
    expect(isEditableTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({} as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("formatHotkey", () => {
  it("uses symbols in HIG order on Apple platforms", () => {
    expect(formatHotkey("mod+s", true)).toBe("⌘S");
    expect(formatHotkey("mod+shift+alt+ctrl+z", true)).toBe("⌃⌥⇧⌘Z");
  });

  it("uses Ctrl+… elsewhere", () => {
    expect(formatHotkey("mod+s", false)).toBe("Ctrl+S");
    expect(formatHotkey("mod+shift+enter", false)).toBe("Ctrl+Shift+Enter");
    expect(formatHotkey("esc")).toBe("Esc");
    expect(formatHotkey("/")).toBe("/");
  });
});

describe("isApplePlatform", () => {
  it("prefers userAgentData, then platform, then userAgent", () => {
    expect(isApplePlatform({ userAgentData: { platform: "macOS" } })).toBe(true);
    expect(isApplePlatform({ platform: "MacIntel" })).toBe(true);
    expect(isApplePlatform({ platform: "iPhone" })).toBe(true);
    expect(isApplePlatform({ platform: "Win32" })).toBe(false);
    expect(
      isApplePlatform({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)" })
    ).toBe(true);
    expect(isApplePlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14)" })).toBe(false);
  });
});

describe("matchesHotkey robustness", () => {
  // Chrome autofill and some extensions dispatch bare `keydown` Events with no
  // `key`; the window listener must not throw on them.
  it("returns false instead of throwing when the event has no key", () => {
    const autofill = {
      code: undefined,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as unknown as HotkeyEvent;
    expect(() => matchesHotkey(autofill, "/")).not.toThrow();
    expect(matchesHotkey(autofill, "/")).toBe(false);
    expect(matchesHotkey(autofill, "a")).toBe(false);
  });
});
