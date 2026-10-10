-- Hand-added backfill: legacy rows without a creation time get their issue
-- date (0001 set their updated_at to the upgrade time, which says nothing),
-- so the column can become NOT NULL and the newest/oldest list order matches
-- quotations_created_at_idx.
UPDATE "quotations" SET "created_at" = COALESCE("issued_date"::timestamp, "updated_at", now()) WHERE "created_at" IS NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "created_at" SET NOT NULL;
