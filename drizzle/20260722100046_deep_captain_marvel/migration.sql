ALTER TABLE "listings" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_platform_slug_index" ON "listings" ("platform","slug");