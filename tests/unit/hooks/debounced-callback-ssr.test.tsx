import { renderToString } from "react-dom/server";

import { useDebouncedCallback } from "@/hooks/use-debounced-value";

describe("useDebouncedCallback", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Children's effects and the parent's layout effects run before the hook's
  // own passive effect; a call made then must not be silently dropped. Effects
  // never run during a server render, which makes that window observable.
  it("is usable before its effects have run", () => {
    const fn = jest.fn();
    function Probe() {
      const save = useDebouncedCallback(fn, 50);
      save("draft");
      return null;
    }
    renderToString(<Probe />);
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith("draft");
  });
});
