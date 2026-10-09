// Shared test doubles for server-action tests (not a test file itself).
import type { EffectiveSettings } from "@/lib/settings/types";

export function testSettings(overrides: Partial<EffectiveSettings> = {}): EffectiveSettings {
  return {
    company: {
      name: "Acme Ltd",
      nameLocal: "艾克米有限公司",
      address: "Taipei",
      vatNumber: "12345678",
      email: "office@acme.test",
      phone: "02-1234-5678",
      website: "",
      isDefault: false,
    },
    payment: null,
    quote: {
      numberPattern: "QT-{YYYY}{MM}{DD}-{SEQ:3}",
      validityDays: 30,
      defaultTaxRate: 5,
      defaultNotes: "",
      defaultTerms: "",
      defaultSalesperson: "",
      showAmountInWords: true,
      footerText: "",
    },
    money: { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 0 },
    appearance: { brandColor: "#1D4ED8" },
    region: { timezone: "Asia/Taipei" },
    mail: {
      enabled: true,
      apiKey: "re_test",
      senderName: "Acme, Inc.",
      senderEmail: "quotes@acme.test",
      ccEmails: [],
      replyTo: "",
    },
    features: { twVatLookup: true },
    auth: { enabled: false },
    version: "1",
    ...overrides,
  };
}

export type RecordedCall = {
  op: string;
  args: unknown[];
  chain: { method: string; args: unknown[] }[];
};

type Op = "insert" | "select" | "update" | "delete" | "execute";

/**
 * A drizzle-like transaction double. Every builder chain (insert().values()
 * .returning(), select().from().where().for(), …) records its calls and, when
 * awaited, resolves with the next queued result for that operation (or []).
 * Queue an Error to make that statement reject.
 */
export function createTxMock(queues: Partial<Record<Op, unknown[]>> = {}) {
  const calls: RecordedCall[] = [];

  function builder(op: Op, args: unknown[]) {
    const call: RecordedCall = { op, args, chain: [] };
    calls.push(call);
    const proxy: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop === "symbol") return undefined;
          if (prop === "then") {
            const queue = queues[op];
            const value = queue && queue.length > 0 ? queue.shift() : [];
            return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              value instanceof Error ? reject(value) : resolve(value);
          }
          return (...chainArgs: unknown[]) => {
            call.chain.push({ method: prop, args: chainArgs });
            return proxy;
          };
        },
      }
    );
    return proxy;
  }

  const tx = {
    insert: (...args: unknown[]) => builder("insert", args),
    select: (...args: unknown[]) => builder("select", args),
    update: (...args: unknown[]) => builder("update", args),
    delete: (...args: unknown[]) => builder("delete", args),
    execute: (...args: unknown[]) => builder("execute", args),
  };

  /** Arguments of the first `method` call in each chain of operation `op`. */
  const argsOf = (op: Op, method: string) =>
    calls
      .filter((c) => c.op === op)
      .map((c) => c.chain.find((link) => link.method === method)?.args[0]);

  return { tx, calls, argsOf };
}
