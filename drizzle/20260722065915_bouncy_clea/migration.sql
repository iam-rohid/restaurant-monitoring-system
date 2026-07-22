CREATE TYPE "availability_check_status" AS ENUM('ok', 'fetch_error', 'parse_error');--> statement-breakpoint
CREATE TYPE "delivery_platform" AS ENUM('wolt');--> statement-breakpoint
CREATE TABLE "availability_checks" (
	"id" serial PRIMARY KEY,
	"listing_id" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "availability_check_status" NOT NULL,
	"is_available" boolean,
	"opening_hours" jsonb DEFAULT '[]' NOT NULL,
	"error_message" text,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "chains" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"platform" "delivery_platform" NOT NULL,
	"url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"location_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"timezone" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"chain_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "availability_checks_listing_id_checked_at_index" ON "availability_checks" ("listing_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "listings_location_id_platform_index" ON "listings" ("location_id","platform");--> statement-breakpoint
CREATE INDEX "locations_chain_id_index" ON "locations" ("chain_id");--> statement-breakpoint
ALTER TABLE "availability_checks" ADD CONSTRAINT "availability_checks_listing_id_listings_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_chain_id_chains_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE;