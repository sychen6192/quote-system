import { createDebounced } from "@/hooks/use-debounced-value";

describe("createDebounced", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("calls once, with the latest arguments, after the delay", () => {
    const fn = jest.fn();
    const d = createDebounced(fn, 600);
    d("a");
    jest.advanceTimersByTime(300);
    d("b");
    jest.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("cancel drops the pending call", () => {
    const fn = jest.fn();
    const d = createDebounced(fn, 100);
    d();
    expect(d.isPending()).toBe(true);
    d.cancel();
    expect(d.isPending()).toBe(false);
    jest.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush runs the pending call now, once", () => {
    const fn = jest.fn();
    const d = createDebounced(fn, 100);
    d(1, 2);
    d.flush();
    expect(fn).toHaveBeenCalledWith(1, 2);
    jest.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush with nothing pending is a no-op", () => {
    const fn = jest.fn();
    const d = createDebounced(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("can be reused after firing", () => {
    const fn = jest.fn();
    const d = createDebounced(fn, 50);
    d("x");
    jest.advanceTimersByTime(50);
    d("y");
    jest.advanceTimersByTime(50);
    expect(fn.mock.calls).toEqual([["x"], ["y"]]);
  });
});

describe("createDebounced with a delay getter", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("reads the delay at call time", () => {
    const fn = jest.fn();
    let delay = 100;
    const d = createDebounced(fn, () => delay);
    d();
    delay = 500;
    d();
    jest.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
