jest.mock("@/db", () => ({ db: { select: jest.fn() } }));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { getDashboardMetrics } from "@/services/dashboard";
import { getSettings } from "@/services/settings";

const dialect = new PgDialect();
const mockSelect = db.select as jest.Mock;

let fields: Record<string, SQL> = {};

beforeEach(() => {
  (getSettings as jest.Mock).mockResolvedValue({ region: { timezone: "Asia/Taipei" } });
  mockSelect.mockImplementation((selection: Record<string, SQL>) => {
    fields = selection;
    return { from: async () => [{ openCount: "2", decided90: "4", accepted90: "1" }] };
  });
});

const paramsOf = (name: string) => dialect.sqlToQuery(fields[name]).params;

describe("getDashboardMetrics", () => {
  it("maps counts to numbers and the 90-day rate to 0–1", async () => {
    const m = await getDashboardMetrics({ today: "2026-10-09", timeZone: "UTC" });
    expect(m.openCount).toBe(2);
    expect(m.acceptanceRate90d).toBe(0.25);
    expect(m.totalQuotes).toBe(0);
  });

  it("derives the month from today and the 90-day window", async () => {
    await getDashboardMetrics({ today: "2026-10-09", timeZone: "Asia/Taipei" });
    expect(paramsOf("acceptedThisMonthCount")).toEqual(
      expect.arrayContaining(["Asia/Taipei", "2026-10-01", "2026-10-09"])
    );
    expect(paramsOf("decided90")).toEqual(expect.arrayContaining(["2026-07-11"]));
  });

  it("ignores an invalid monthStart / timeZone instead of sending it to SQL", async () => {
    await getDashboardMetrics({ today: "2026-10-09", monthStart: "bogus", timeZone: "Mars/Base" });
    const params = paramsOf("acceptedThisMonthCount");
    expect(params).toEqual(expect.arrayContaining(["UTC", "2026-10-01"]));
    expect(params).not.toContain("bogus");
  });
});
