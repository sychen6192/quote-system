-- Baseline migration (hand-edited from `drizzle-kit generate` output).
-- Idempotent on purpose: databases created earlier with `drizzle-kit push`
-- already contain these objects but have no drizzle.__drizzle_migrations row,
-- so the migrator will run this file against them exactly once.
-- Rule: every later migration (0001+) is plain generated SQL; only 0000 is special.
CREATE TABLE IF NOT EXISTS "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"address" text,
	"vat_number" text,
	"email" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"is_taxable" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"customer_id" integer,
	"salesperson" text NOT NULL,
	"issued_date" date DEFAULT now(),
	"valid_until" date NOT NULL,
	"shipping_date" date,
	"payment_method" text,
	"shipping_method" text,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_rate" integer DEFAULT 500,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"other_fees" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
-- Columns that may be missing on a database pushed from an older schema.ts.
-- (NOT NULL columns without a default are intentionally omitted: they existed
-- from day one, and adding them to a populated table would fail anyway.)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_person" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "vat_number" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "is_taxable" boolean DEFAULT true;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "shipping_date" date;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "shipping_method" text;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "other_fees" integer DEFAULT 0;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft';
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_quotation_number_unique' AND conrelid = 'public.quotations'::regclass) THEN
		ALTER TABLE "quotations" ADD CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number");
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_quotation_id_quotations_id_fk' AND conrelid = 'public.quotation_items'::regclass) THEN
		ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_customer_id_customers_id_fk' AND conrelid = 'public.quotations'::regclass) THEN
		ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
