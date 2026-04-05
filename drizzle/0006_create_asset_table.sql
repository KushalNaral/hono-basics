CREATE TABLE IF NOT EXISTS "asset" (
  "id" text PRIMARY KEY NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "filename" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size" integer NOT NULL,
  "url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_resource_idx" ON "asset" USING btree ("resource_type","resource_id");
