jest.mock("@/db", () => ({ db: { execute: jest.fn() } }));

import { db } from "@/db";
import { GET, dynamic } from "@/app/api/health/route";

const execute = db.execute as unknown as jest.Mock;

describe("GET /api/health", () => {
  afterEach(() => jest.useRealTimers());

  it("is dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("answers 200 {status:'ok'} when the database responds", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("answers 503 when the database fails", async () => {
    execute.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "error" });
  });

  it("answers 503 when the database hangs", async () => {
    jest.useFakeTimers();
    execute.mockReturnValueOnce(new Promise(() => {}));
    const pending = GET();
    await jest.advanceTimersByTimeAsync(3000);
    const res = await pending;
    expect(res.status).toBe(503);
  });
});
