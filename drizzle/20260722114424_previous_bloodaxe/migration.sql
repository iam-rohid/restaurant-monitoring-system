ALTER TABLE "chains" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chains" ADD CONSTRAINT "chains_slug_key" UNIQUE("slug");