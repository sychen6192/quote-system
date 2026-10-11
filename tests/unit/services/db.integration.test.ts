// End-to-end checks of the quote actions and SQL-heavy services against a
// real, migrated Postgres. Skipped unless TEST_DATABASE_URL is set.
// WARNING: truncates every quote table in that database.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/qs_a2 npx jest tests/unit/services/db.integration
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(async () => undefined),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));

import { sql } from "drizzle-orm";
import { createQuote } from "@/actions/create-quote";
import { deleteQuote } from "@/actions/delete-quote";
import { setQuoteStatus } from "@/actions/quote-status";
import { updateQuote } from "@/actions/update-quote";
import { closeDb, db } from "@/db";
import { quotations } from "@/db/schema";
import { quoteViewFromRecord } from "@/lib/quote-view";
import {
  getCustomerDirectory,
  getLatestCustomerByName,
  recentCustomerOptions,
  searchCustomerOptions,
} from "@/services/customers";
import { getDashboardMetrics, getExpiringSoon, getRecentQuotes } from "@/services/dashboard";
import { quotesToCsv } from "@/services/export";
import { recentProductOptions, searchProductOptions } from "@/services/products";
import {
  getQuoteById,
  getQuotesList,
  quoteExportBatches,
  quoteListOrder,
  rowsOf,
  type QuoteListItem,
  type QuoteListParams,
} from "@/services/quotes";
import { getSettings } from "@/services/settings";
import { testSettings } from "../actions/helpers";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

// The suite truncates every quote table: refuse the app's own database name
// (docker-compose / README default) in case a real DATABASE_URL is pasted in.
if (TEST_DATABASE_URL) {
  const name = decodeURIComponent(new URL(TEST_DATABASE_URL).pathname.replace(/^\//, ""));
  if (name === "quote-system") {
    throw new Error(
      `Refusing to run destructive DB tests against "${name}"; point TEST_DATABASE_URL at a throwaway database.`
    );
  }
}
const TODAY = "2026-10-09";

function input(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme Corp",
    contactPerson: "Jane",
    email: "jane@acme.test",
    phone: "",
    address: "Taipei",
    vatNumber: "12345678",
    title: "",
    salesperson: "Alice",
    issuedDate: TODAY,
    validUntil: "2026-11-08",
    shippingDate: "",
    paymentMethod: "",
    shippingMethod: "",
    taxRate: 5,
    discountType: "amount",
    discountValue: 0,
    otherFees: 0,
    notes: "",
    terms: "",
    items: [{ productName: "Widget", quantity: 2, unitPrice: 100, isTaxable: true }],
    ...overrides,
  };
}

async function create(overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await createQuote(input(overrides));
  if (!res.success || res.id === undefined) throw new Error(`createQuote failed: ${JSON.stringify(res)}`);
  return res.id;
}

async function query(text: ReturnType<typeof sql>) {
  return rowsOf(await db.execute(text));
}

async function exportAll(params: QuoteListParams, batchSize?: number) {
  const batches: QuoteListItem[][] = [];
  for await (const batch of quoteExportBatches(params, { batchSize })) batches.push(batch);
  return batches;
}

async function reset() {
  await db.execute(
    sql`truncate quote_events, quotation_items, quotations, customers, quote_counters restart identity cascade`
  );
}

describeDb("quotes against Postgres", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    await closeDb();
  });

  beforeEach(async () => {
    (getSettings as jest.Mock).mockResolvedValue(testSettings());
    await reset();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe("createQuote + numbering", () => {
    it("persists the quote, snapshot, items and event with sequential numbers", async () => {
      const first = await create({
        title: "Phase 1",
        discountType: "percent",
        discountValue: 10,
        otherFees: 99.5,
        items: [
          { productName: "Design", description: "Logo", unit: "式", quantity: 1.5, unitPrice: 333.33 },
          { productName: "Hosting", quantity: 12, unitPrice: 10, isTaxable: false },
        ],
      });
      const second = await create();

      const a = await getQuoteById(first);
      const b = await getQuoteById(second);
      expect(a?.quotationNumber).toBe("QT-20261009-001");
      expect(b?.quotationNumber).toBe("QT-20261009-002");
      expect(a).toMatchObject({
        title: "Phase 1",
        status: "draft",
        discountType: "percent",
        discountValue: 1000,
        otherFees: 9950,
        taxRate: 500,
      });
      expect(a?.items.map((i) => [i.position, i.productName, i.quantity, i.unitPrice, i.isTaxable])).toEqual([
        [0, "Design", 1.5, 33333, true],
        [1, "Hosting", 12, 1000, false],
      ]);
      expect(a?.customer).toMatchObject({ companyName: "Acme Corp", phone: null });
      expect(a?.events.map((e) => e.type)).toEqual(["created"]);

      // stored totals equal the shared view model's totals (TWD: whole NT$)
      const view = quoteViewFromRecord(a!, { today: TODAY, minorUnitStep: 100 });
      expect([a?.subtotal, a?.discountAmount, a?.taxAmount, a?.totalAmount]).toEqual([
        view.totals.subtotal,
        view.totals.discount,
        view.totals.tax,
        view.totals.total,
      ]);
    });

    it("hands out unique numbers to concurrent creates", async () => {
      const ids = await Promise.all(Array.from({ length: 12 }, () => create()));
      const numbers = (await query(sql`select quotation_number from quotations order by 1`)).map(
        (r) => r.quotation_number
      );
      expect(ids).toHaveLength(12);
      expect(numbers).toEqual(
        Array.from({ length: 12 }, (_, i) => `QT-20261009-${String(i + 1).padStart(3, "0")}`)
      );
      expect(await query(sql`select value from quote_counters`)).toEqual([{ value: 12 }]);
    });

    it("continues after legacy numbers and skips numbers that already exist", async () => {
      const legacy = await create({ issuedDate: "2026-01-02", validUntil: "2026-02-01" });
      await db.execute(sql`update quotations set quotation_number = 'QT-20260103-007' where id = ${legacy}`);
      await db.execute(sql`delete from quote_counters`);
      const next = await getQuoteById(await create({ issuedDate: "2026-01-03", validUntil: "2026-02-01" }));
      expect(next?.quotationNumber).toBe("QT-20260103-008");

      // a manual number in the way of the counter is skipped
      await db.execute(sql`insert into quote_counters (scope, value) values ('QT-20260104-', 0)`);
      const manual = await create({ issuedDate: "2026-01-02", validUntil: "2026-02-01" });
      await db.execute(sql`update quotations set quotation_number = 'QT-20260104-001' where id = ${manual}`);
      const after = await getQuoteById(await create({ issuedDate: "2026-01-04", validUntil: "2026-02-01" }));
      expect(after?.quotationNumber).toBe("QT-20260104-002");
    });

    it("renders the configured pattern from the issue date (ROC year)", async () => {
      (getSettings as jest.Mock).mockResolvedValue(
        testSettings({ quote: { ...testSettings().quote, numberPattern: "{ROC}{MM}{DD}-{SEQ:3}" } })
      );
      const id = await create({ issuedDate: "2026-03-05", validUntil: "2026-04-05" });
      expect((await getQuoteById(id))?.quotationNumber).toBe("1150305-001");
    });

    it("does not persist anything when validation fails", async () => {
      const res = await createQuote(input({ items: [] }));
      expect(res).toMatchObject({ code: "VALIDATION" });
      expect(await query(sql`select count(*)::int as n from customers`)).toEqual([{ n: 0 }]);
    });
  });

  describe("updateQuote / setQuoteStatus / deleteQuote", () => {
    it("updates every field, replaces items and bumps updated_at", async () => {
      const id = await create();
      await db.execute(sql`update quotations set updated_at = '2020-01-01' where id = ${id}`);
      const res = await updateQuote(
        id,
        input({
          companyName: "Acme Taiwan",
          title: "Revised",
          paymentMethod: "月結30天",
          shippingMethod: "宅配",
          shippingDate: "2026-10-20",
          notes: "n",
          terms: "t",
          discountType: "amount",
          discountValue: 50,
          items: [
            { productName: "B", quantity: 1, unitPrice: 10 },
            { productName: "A", quantity: 3, unitPrice: 20 },
          ],
        })
      );
      expect(res).toEqual({ success: true, id });
      const q = await getQuoteById(id);
      expect(q).toMatchObject({
        title: "Revised",
        paymentMethod: "月結30天",
        shippingMethod: "宅配",
        shippingDate: "2026-10-20",
        notes: "n",
        terms: "t",
        subtotal: 7000,
        discountAmount: 5000,
        taxAmount: 100,
        totalAmount: 2100,
      });
      expect(q?.customer?.companyName).toBe("Acme Taiwan");
      expect(q?.items.map((i) => i.productName)).toEqual(["B", "A"]);
      expect(q?.updatedAt?.getFullYear()).toBeGreaterThan(2020);
      expect(q?.events.map((e) => e.type)).toEqual(["updated", "created"]);
    });

    it("returns NOT_FOUND for a missing quote", async () => {
      await expect(updateQuote(424242, input())).resolves.toMatchObject({ code: "NOT_FOUND" });
      await expect(setQuoteStatus(424242, "sent")).resolves.toMatchObject({ code: "NOT_FOUND" });
      await expect(deleteQuote(424242)).resolves.toMatchObject({ code: "NOT_FOUND" });
    });

    it("tracks sent/decided timestamps and logs status changes", async () => {
      const id = await create();
      await setQuoteStatus(id, "sent");
      let q = await getQuoteById(id);
      expect(q?.status).toBe("sent");
      expect(q?.sentAt).toBeInstanceOf(Date);
      expect(q?.decidedAt).toBeNull();

      await setQuoteStatus(id, "accepted");
      q = await getQuoteById(id);
      expect(q?.decidedAt).toBeInstanceOf(Date);

      await setQuoteStatus(id, "draft");
      q = await getQuoteById(id);
      expect(q?.decidedAt).toBeNull();
      expect(q?.sentAt).toBeInstanceOf(Date);
      expect(q?.events.map((e) => [e.type, e.data])).toEqual([
        ["status_changed", { from: "accepted", to: "draft" }],
        ["status_changed", { from: "sent", to: "accepted" }],
        ["status_changed", { from: "draft", to: "sent" }],
        ["created", { quotationNumber: q?.quotationNumber }],
      ]);
    });

    it("deletes the quote with its items, events and customer snapshot", async () => {
      const id = await create();
      await setQuoteStatus(id, "sent");
      await expect(deleteQuote(id)).resolves.toEqual({ success: true, id });
      const counts = await query(sql`
        select (select count(*) from quotations)::int as q, (select count(*) from quotation_items)::int as i,
               (select count(*) from quote_events)::int as e, (select count(*) from customers)::int as c`);
      expect(counts).toEqual([{ q: 0, i: 0, e: 0, c: 0 }]);
      await expect(deleteQuote(id)).resolves.toMatchObject({ code: "NOT_FOUND" });
    });

    it("keeps a customer row that another quote still references", async () => {
      const keep = await create();
      const drop = await create();
      const [{ customer_id: shared }] = await query(sql`select customer_id from quotations where id = ${keep}`);
      await db.execute(sql`update quotations set customer_id = ${shared} where id = ${drop}`);
      await deleteQuote(drop);
      expect((await getQuoteById(keep))?.customer?.id).toBe(shared);

      // and editing the survivor never rewrites another quote's snapshot
      const third = await create();
      await db.execute(sql`update quotations set customer_id = ${shared} where id = ${third}`);
      await updateQuote(third, input({ companyName: "Renamed" }));
      expect((await getQuoteById(keep))?.customer?.companyName).toBe("Acme Corp");
      expect((await getQuoteById(third))?.customer?.companyName).toBe("Renamed");
    });
  });

  describe("list, dashboard, directory, products, export", () => {
    let ids: Record<string, number>;

    beforeEach(async () => {
      ids = {
        draft: await create({ companyName: "50%_Off Ltd", title: "Promo", items: [{ productName: "Widget", quantity: 1, unitPrice: 100 }] }),
        sent: await create({ companyName: "Acme Corp", items: [{ productName: "Widget Pro", quantity: 1, unitPrice: 300 }] }),
        expired: await create({ companyName: " acme corp ", validUntil: TODAY, issuedDate: "2026-09-01", items: [{ productName: "widget", description: "old", quantity: 1, unitPrice: 50 }] }),
        accepted: await create({ companyName: "Beta", contactPerson: "Bob", items: [{ productName: "Gadget", quantity: 1, unitPrice: 1000 }] }),
        rejected: await create({ companyName: "500 Off Inc", items: [{ productName: "Gizmo", quantity: 2, unitPrice: 10 }] }),
      };
      await setQuoteStatus(ids.sent, "sent");
      await setQuoteStatus(ids.expired, "sent");
      await setQuoteStatus(ids.accepted, "accepted");
      await setQuoteStatus(ids.rejected, "rejected");
      // expired yesterday; decided timestamps pinned for deterministic KPIs
      await db.execute(sql`update quotations set valid_until = '2026-10-08' where id = ${ids.expired}`);
      await db.execute(sql`update quotations set decided_at = '2026-10-08 18:00:00' where id = ${ids.accepted}`); // 10-09 02:00 Taipei
      await db.execute(sql`update quotations set decided_at = '2026-08-01 00:00:00' where id = ${ids.rejected}`);
    });

    it("filters by display status and counts every status", async () => {
      const all = await getQuotesList({ today: TODAY });
      expect(all.statusCounts).toEqual({ all: 5, draft: 1, sent: 1, accepted: 1, rejected: 1, expired: 1 });
      expect(all.metadata).toEqual({ total: 5, page: 1, pageSize: 20, totalPages: 1 });

      const expired = await getQuotesList({ status: "expired", today: TODAY });
      expect(expired.data.map((q) => q.id)).toEqual([ids.expired]);
      expect(expired.data[0].displayStatus).toBe("expired");

      const sent = await getQuotesList({ status: "sent", today: TODAY });
      expect(sent.data.map((q) => q.id)).toEqual([ids.sent]);
      expect(sent.metadata.total).toBe(1);
    });

    it("searches literally (wildcards escaped) across number, title, company, contact", async () => {
      expect((await getQuotesList({ q: "50%", today: TODAY })).data.map((q) => q.id)).toEqual([ids.draft]);
      expect((await getQuotesList({ q: "_off", today: TODAY })).data.map((q) => q.id)).toEqual([ids.draft]);
      expect((await getQuotesList({ q: "bob", today: TODAY })).data.map((q) => q.id)).toEqual([ids.accepted]);
      expect((await getQuotesList({ q: "promo", today: TODAY })).data.map((q) => q.id)).toEqual([ids.draft]);
      expect((await getQuotesList({ q: "QT-20261009-002", today: TODAY })).data.map((q) => q.id)).toEqual([ids.sent]);
      const acme = await getQuotesList({ q: "ACME", today: TODAY });
      expect(acme.statusCounts.all).toBe(2);
      expect(acme.data.every((q) => q.customer?.companyName.toLowerCase().includes("acme"))).toBe(true);
    });

    it("sorts and clamps pages", async () => {
      const byAmount = await getQuotesList({ sort: "amount_desc", today: TODAY });
      expect(byAmount.data[0].id).toBe(ids.accepted);
      const page = await getQuotesList({ page: 999, pageSize: 2, sort: "oldest", today: TODAY });
      expect(page.metadata).toEqual({ total: 5, page: 3, pageSize: 2, totalPages: 3 });
      expect(page.data.map((q) => q.id)).toEqual([ids.rejected]);
      const negative = await getQuotesList({ page: -3, pageSize: 2, sort: "oldest", today: TODAY });
      expect(negative.metadata.page).toBe(1);
      const none = await getQuotesList({ q: "zzz", page: 4, today: TODAY });
      expect(none).toMatchObject({ data: [], metadata: { total: 0, page: 1, totalPages: 1 } });
    });

    it("computes dashboard KPIs in the business timezone", async () => {
      const m = await getDashboardMetrics({ today: TODAY, timeZone: "Asia/Taipei" });
      expect(m).toEqual({
        openPipelineValue: 31500, // the sent, unexpired quote (300 + 5%)
        openCount: 1,
        acceptedThisMonthValue: 105000,
        acceptedThisMonthCount: 1,
        acceptedTotalValue: 105000,
        acceptanceRate90d: 0.5,
        draftCount: 1,
        expiredCount: 1,
        totalQuotes: 5,
        totalCustomers: 4, // "Acme Corp" and " acme corp " are one customer
      });
      // Decided 2026-10-31 18:00 UTC = 2026-11-01 02:00 in Taipei: November there, October in UTC.
      await db.execute(sql`update quotations set decided_at = '2026-10-31 18:00:00' where id = ${ids.accepted}`);
      const taipeiNov = await getDashboardMetrics({ today: "2026-11-02", timeZone: "Asia/Taipei" });
      expect(taipeiNov.acceptedThisMonthCount).toBe(1);
      expect(taipeiNov.openCount).toBe(1); // valid until 2026-11-08
      const utcNov = await getDashboardMetrics({ today: "2026-11-02", timeZone: "UTC" });
      expect(utcNov.acceptedThisMonthCount).toBe(0);
    });

    it("lists recent and expiring quotes", async () => {
      const recent = await getRecentQuotes(3, TODAY);
      expect(recent.map((q) => q.id)).toEqual([ids.rejected, ids.accepted, ids.expired]);
      expect(recent[2].displayStatus).toBe("expired");

      await db.execute(sql`update quotations set valid_until = '2026-10-12' where id = ${ids.sent}`);
      const expiring = await getExpiringSoon(TODAY, 7);
      expect(expiring.map((q) => [q.id, q.daysLeft])).toEqual([[ids.sent, 3]]);
    });

    it("groups the customer directory by normalised name", async () => {
      await setQuoteStatus(ids.sent, "accepted");
      const dir = await getCustomerDirectory({});
      expect(dir.metadata.total).toBe(4);
      const acme = dir.data.find((c) => c.key === "acme corp");
      expect(acme).toMatchObject({
        companyName: "acme corp", // newest snapshot wins (input is trimmed on save)
        quoteCount: 2,
        acceptedTotal: 31500,
        lastIssuedDate: TODAY,
        lastQuoteId: ids.sent,
      });
      const filtered = await getCustomerDirectory({ q: "bob" });
      expect(filtered.data.map((c) => c.companyName)).toEqual(["Beta"]);
      const paged = await getCustomerDirectory({ page: 99, pageSize: 3 });
      expect(paged.metadata).toEqual({ total: 4, page: 2, pageSize: 3, totalPages: 2 });
      expect(paged.data).toHaveLength(1);

      // name, contact, VAT and email all match; names starting with the term come first
      const byEmail = await searchCustomerOptions("ac");
      expect(byEmail).toHaveLength(4);
      expect(byEmail[0].companyName).toBe("acme corp");
      expect(await searchCustomerOptions("acme c")).toEqual([
        expect.objectContaining({ companyName: "acme corp" }),
      ]);
      expect(await searchCustomerOptions("%")).toEqual([expect.objectContaining({ companyName: "50%_Off Ltd" })]);
      expect(await getLatestCustomerByName("ACME CORP")).toMatchObject({ companyName: "acme corp" });
      expect(await getLatestCustomerByName("nobody")).toBeNull();

      // Nothing typed yet: the companies quoted most recently, newest snapshot each.
      expect((await recentCustomerOptions()).map((c) => c.companyName)).toEqual([
        "500 Off Inc",
        "Beta",
        "acme corp",
        "50%_Off Ltd",
      ]);
      expect((await recentCustomerOptions(2)).map((c) => c.companyName)).toEqual(["500 Off Inc", "Beta"]);
      expect((await recentCustomerOptions())[1]).toMatchObject({ companyName: "Beta", contactPerson: "Bob" });
    });

    it("suggests products from past lines (newest per normalised name)", async () => {
      const options = await searchProductOptions("wid");
      expect(options).toEqual([
        { productName: "widget", description: "old", unit: null, unitPrice: 5000, isTaxable: true },
        { productName: "Widget Pro", description: null, unit: null, unitPrice: 30000, isTaxable: true },
      ]);
      expect(await searchProductOptions("_")).toEqual([]);

      // Nothing typed yet: the items used most recently, newest line each.
      expect((await recentProductOptions()).map((o) => o.productName)).toEqual([
        "Gizmo",
        "Gadget",
        "widget",
        "Widget Pro",
      ]);
      expect(await recentProductOptions(1)).toEqual([
        { productName: "Gizmo", description: null, unit: null, unitPrice: 1000, isTaxable: true },
      ]);
    });

    it("exports the filtered list as CSV", async () => {
      const rows = (await exportAll({ status: "expired", today: TODAY })).flat();
      const csv = quotesToCsv(rows, { locale: "en", currency: "TWD", fractionDigits: 0 });
      const lines = csv.split("\r\n").filter(Boolean);
      expect(lines).toHaveLength(2);
      // numbered from its own issue date
      expect(lines[1]).toMatch(/^QT-20260901-001,,Expired,2026-09-01,2026-10-08,acme corp,Jane,.*,TWD,50,0,3,0,53,,,$/);
    });

    it("filters by exact customer (case and spaces ignored), unlike the search", async () => {
      const byName = await getQuotesList({ customer: "ACME CORP", today: TODAY });
      expect(byName.data.map((q) => q.id).sort()).toEqual([ids.sent, ids.expired].sort());
      expect(byName.statusCounts.all).toBe(2);
      // "500 Off Inc" contains "Off" but is not "50%_Off Ltd"
      const exact = await getQuotesList({ customer: "50%_off ltd", today: TODAY });
      expect(exact.data.map((q) => q.id)).toEqual([ids.draft]);
      const search = await getQuotesList({ q: "Acme", today: TODAY });
      expect(search.metadata.total).toBe(2);
      await create({ companyName: "Acme Corp Holdings" });
      expect((await getQuotesList({ q: "Acme Corp", today: TODAY })).metadata.total).toBe(3);
      expect((await getQuotesList({ customer: "Acme Corp", today: TODAY })).metadata.total).toBe(2);
      const exported = (await exportAll({ customer: "acme corp", today: TODAY })).flat();
      expect(exported.map((q) => q.id).sort()).toEqual([ids.sent, ids.expired].sort());
    });

    // ?q=%00 used to reach Postgres and fail the whole page.
    it("ignores NUL in search input instead of failing", async () => {
      await expect(getQuotesList({ q: "\u0000", today: TODAY })).resolves.toMatchObject({ metadata: { total: 5 } });
      await expect(getQuotesList({ q: "Ac\u0000me", customer: "\u0000", today: TODAY })).resolves.toMatchObject({
        metadata: { total: 2 },
      });
      await expect(exportAll({ q: "a\u0000", today: TODAY })).resolves.toBeDefined();
      await expect(getCustomerDirectory({ q: "\u0000" })).resolves.toMatchObject({ metadata: { total: 4 } });
      await expect(searchCustomerOptions("\u0000")).resolves.toEqual([]);
      await expect(searchProductOptions("wid\u0000")).resolves.toHaveLength(2);
      await expect(getLatestCustomerByName("\u0000")).resolves.toBeNull();
    });
  });

  // The CSV used to stop silently at 10 000 rows; it now pages by keyset.
  describe("CSV export batches", () => {
    it.each(["newest", "oldest", "amount_desc", "amount_asc", "valid_until"])(
      "returns every row exactly once, in list order (%s)",
      async (sort) => {
        for (let i = 0; i < 5; i++) {
          // ties on the sort column (same total / valid-until) must not skip rows
          await create({ items: [{ productName: "W", quantity: 1, unitPrice: 100 * (i % 2) + 100 }], validUntil: "2026-11-08" });
        }
        // equal created_at down to the millisecond, distinct only in microseconds
        await db.execute(sql`update quotations set created_at = ('2026-10-09 01:02:03.123' || (id % 3)::text)::timestamp`);
        const batches = await exportAll({ sort, today: TODAY }, 2);
        expect(batches.map((b) => b.length)).toEqual([2, 2, 1]);
        const exported = batches.flat().map((q) => q.id);
        const listed = (await getQuotesList({ sort, today: TODAY, pageSize: 100 })).data.map((q) => q.id);
        expect(exported).toEqual(listed);
        expect(new Set(exported).size).toBe(5);
      }
    );

    it("handles an exact multiple of the batch size and an empty result", async () => {
      for (let i = 0; i < 4; i++) await create();
      expect((await exportAll({ today: TODAY }, 2)).map((b) => b.length)).toEqual([2, 2]);
      expect(await exportAll({ q: "no such quote", today: TODAY }, 2)).toEqual([]);
    });
  });

  // Plans: the newest-first list and the dashboard must read the created_at
  // index instead of sorting every quote (and joining its customer).
  describe("query plans", () => {
    async function plan(text: ReturnType<typeof sql>): Promise<string> {
      return db.transaction(async (tx) => {
        await tx.execute(sql`set local enable_seqscan = off`);
        const rows = rowsOf(await tx.execute(sql`explain ${text}`));
        return rows.map((r) => String(Object.values(r)[0])).join("\n");
      });
    }

    it("serves newest/oldest from quotations_created_at_idx", async () => {
      for (let i = 0; i < 3; i++) await create();
      for (const sort of ["newest", "oldest"] as const) {
        const q = db.select({ id: quotations.id }).from(quotations).orderBy(...quoteListOrder(sort)).limit(20).toSQL();
        const text = sql.raw(q.sql.replace(/\$(\d+)/g, (_m, n) => String(q.params[Number(n) - 1])));
        expect(await plan(text)).toMatch(/quotations_created_at_idx/);
      }
      const recent = db.query.quotations.findMany({
        with: { customer: true },
        orderBy: (t, { desc }) => [desc(t.createdAt), desc(t.id)],
        limit: 6,
      }).toSQL();
      const text = sql.raw(recent.sql.replace(/\$(\d+)/g, (_m, n) => String(recent.params[Number(n) - 1])));
      expect(await plan(text)).toMatch(/quotations_created_at_idx/);
      // ordering itself is unchanged
      expect((await getRecentQuotes(6, TODAY)).map((q) => q.id)).toEqual(
        (await getQuotesList({ today: TODAY })).data.map((q) => q.id).slice(0, 6)
      );
    });
  });

  // Two open editors must not silently overwrite each other.
  describe("updateQuote version check", () => {
    it("saves with the loaded version and refuses a stale one", async () => {
      const id = await create();
      const loaded = (await getQuoteById(id))!.updatedAt;
      await expect(updateQuote(id, input({ title: "first" }), loaded?.toISOString() ?? null)).resolves.toEqual({
        success: true,
        id,
      });
      await expect(updateQuote(id, input({ title: "second" }), loaded?.toISOString() ?? null)).resolves.toMatchObject({
        code: "CONFLICT",
      });
      expect((await getQuoteById(id))?.title).toBe("first");
      const current = (await getQuoteById(id))!.updatedAt!;
      await expect(updateQuote(id, input({ title: "third" }), current.getTime())).resolves.toMatchObject({
        success: true,
      });
    });
  });

  // Columns are timestamp without time zone, read as UTC: a server whose
  // TimeZone is Asia/Taipei must not put database-written times 8 h ahead.
  describe("session time zone", () => {
    const dbName = () => new URL(TEST_DATABASE_URL!).pathname.slice(1);

    afterEach(async () => {
      await db.execute(sql.raw(`alter database "${dbName()}" reset timezone`));
      await closeDb();
    });

    it("writes created_at and event times in UTC whatever the server zone", async () => {
      await db.execute(sql.raw(`alter database "${dbName()}" set timezone = 'Asia/Taipei'`));
      await closeDb(); // new sessions pick the database setting up
      const id = await create();
      const q = await getQuoteById(id);
      const now = Date.now();
      expect(Math.abs(q!.createdAt.getTime() - now)).toBeLessThan(60_000);
      expect(Math.abs(q!.updatedAt!.getTime() - now)).toBeLessThan(60_000);
      expect(Math.abs(q!.events[0].createdAt.getTime() - now)).toBeLessThan(60_000);
      const [{ tz }] = await query(sql`show timezone`);
      expect(tz ?? Object.values((await query(sql`show timezone`))[0])[0]).toBe("UTC");
    });
  });
});
