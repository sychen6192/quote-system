CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branding_assets" (
	"kind" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_counters" (
	"scope" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "quantity" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "unit_price" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "subtotal" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "tax_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "other_fees" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "total_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_type" text DEFAULT 'amount' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_value" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "terms" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "decided_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_quotations_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_events_quote_id_idx" ON "quote_events" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_company_name_norm_idx" ON "customers" USING btree (lower(btrim("company_name")));--> statement-breakpoint
CREATE INDEX "customers_vat_number_idx" ON "customers" USING btree ("vat_number");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items" USING btree ("quotation_id","position");--> statement-breakpoint
CREATE INDEX "quotation_items_product_name_norm_idx" ON "quotation_items" USING btree (lower(btrim("product_name")));--> statement-breakpoint
CREATE INDEX "quotations_created_at_idx" ON "quotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_valid_until_idx" ON "quotations" USING btree ("valid_until");--> statement-breakpoint
-- Hand-added backfills (data only, no schema change):
-- keep the historical item order explicit now that it is a column,
UPDATE "quotation_items" AS qi SET "position" = ranked.rn
FROM (
	SELECT "id", (row_number() OVER (PARTITION BY "quotation_id" ORDER BY "id") - 1)::integer AS rn
	FROM "quotation_items"
) AS ranked
WHERE qi."id" = ranked."id";--> statement-breakpoint
-- and give pre-existing quotes a meaningful updated_at.
UPDATE "quotations" SET "updated_at" = COALESCE("created_at", now());
