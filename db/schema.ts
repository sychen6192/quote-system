import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/*
 * Money is stored as integer minor units ×100 ("cents") in bigint columns
 * (mode "number": safe up to 2^53, i.e. ~90 trillion major units).
 * Tax and percentage discounts are stored as basis points (500 = 5.00%).
 * Quantities are numeric(12,3) so hours / kg / m² can be fractional.
 *
 * Every schema change needs a committed migration: `npm run db:generate`.
 * drizzle/0000_baseline.sql is hand-edited to be idempotent; never edit a
 * migration that has already shipped.
 */

// 1. Customers — one row per quote (a bill-to snapshot that keeps historical
//    quotes unchanged when a later quote edits the same company). The
//    customer directory groups rows by normalised company name.
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyName: text("company_name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    address: text("address"),
    vatNumber: text("vat_number"),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("customers_company_name_norm_idx").on(
      sql`lower(btrim(${t.companyName}))`
    ),
    index("customers_vat_number_idx").on(t.vatNumber),
  ]
);

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export const DISCOUNT_TYPES = ["amount", "percent"] as const;

// 2. Quotations
export const quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    quotationNumber: text("quotation_number").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id),
    title: text("title"),
    salesperson: text("salesperson").notNull(),
    issuedDate: date("issued_date").defaultNow(),
    validUntil: date("valid_until").notNull(),
    // UI labels: paymentMethod = 付款條件 (payment terms),
    // shippingMethod = 交貨方式, shippingDate = 交貨日期.
    shippingDate: date("shipping_date"),
    paymentMethod: text("payment_method"),
    shippingMethod: text("shipping_method"),
    // Financials in cents (see header comment)
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discountType: text("discount_type", { enum: DISCOUNT_TYPES })
      .notNull()
      .default("amount"),
    // cents when discountType = 'amount', basis points when 'percent'
    discountValue: bigint("discount_value", { mode: "number" })
      .notNull()
      .default(0),
    discountAmount: bigint("discount_amount", { mode: "number" })
      .notNull()
      .default(0),
    taxRate: integer("tax_rate").default(500), // basis points: 500 = 5.00%
    taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
    // Untaxed pass-through fees (shipping etc.), added after tax.
    otherFees: bigint("other_fees", { mode: "number" }).default(0),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    status: text("status", { enum: QUOTE_STATUSES }).default("draft"),
    notes: text("notes"),
    terms: text("terms"),
    sentAt: timestamp("sent_at"),
    decidedAt: timestamp("decided_at"),
    // NOT NULL (0002) so the list's newest/oldest order is a plain index scan.
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("quotations_created_at_idx").on(t.createdAt),
    index("quotations_customer_id_idx").on(t.customerId),
    index("quotations_status_idx").on(t.status),
    index("quotations_valid_until_idx").on(t.validUntil),
  ]
);

// 3. Quotation items
export const quotationItems = pgTable(
  "quotation_items",
  {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
    productName: text("product_name").notNull(),
    description: text("description"),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" })
      .notNull()
      .default(1),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(), // cents
    isTaxable: boolean("is_taxable").default(true),
  },
  (t) => [
    index("quotation_items_quotation_id_idx").on(t.quotationId, t.position),
    index("quotation_items_product_name_norm_idx").on(
      sql`lower(btrim(${t.productName}))`
    ),
  ]
);

// 4. Quote activity log (created / updated / status_changed / emailed / duplicated)
export const quoteEvents = pgTable(
  "quote_events",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("quote_events_quote_id_idx").on(t.quoteId, t.createdAt)]
);

// 5. Race-safe quote number counters, one row per rendered number prefix
//    (e.g. scope "QT-20261009-" for the default daily pattern).
export const quoteCounters = pgTable("quote_counters", {
  scope: text("scope").primaryKey(),
  value: integer("value").notNull().default(0),
});

// 6. App settings edited in the Settings page (single row, id = 1).
//    Values here override env vars, which override built-in defaults.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Uploaded branding images (logo / stamp / icon), base64-encoded so a
//    plain pg_dump backs up everything.
export const brandingAssets = pgTable("branding_assets", {
  kind: text("kind", { enum: ["logo", "stamp", "icon"] }).primaryKey(),
  mime: text("mime").notNull(),
  dataBase64: text("data_base64").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  quotations: many(quotations),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  items: many(quotationItems),
  events: many(quoteEvents),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
}));

export const quoteEventsRelations = relations(quoteEvents, ({ one }) => ({
  quote: one(quotations, {
    fields: [quoteEvents.quoteId],
    references: [quotations.id],
  }),
}));
