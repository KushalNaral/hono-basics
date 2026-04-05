-- Step 1: Add id column to role table with UUIDs (if not already present)
ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "id" text;
--> statement-breakpoint
UPDATE "role" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint

-- Step 2: Drop existing FK and PK on role_permission
ALTER TABLE "role_permission" DROP CONSTRAINT IF EXISTS "role_permission_role_role_name_fk";
--> statement-breakpoint
ALTER TABLE "role_permission" DROP CONSTRAINT IF EXISTS "role_permission_role_permission_id_pk";
--> statement-breakpoint
DROP INDEX IF EXISTS "role_permission_role_idx";
--> statement-breakpoint
ALTER TABLE "role" DROP CONSTRAINT IF EXISTS "role_pkey";
--> statement-breakpoint

-- Step 3: Set id as new PK, name as unique
ALTER TABLE "role" ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_name_unique" UNIQUE ("name");
--> statement-breakpoint

-- Step 4: Rename role_permission.role to role_permission.role_id and populate with role.id
ALTER TABLE "role_permission" RENAME COLUMN "role" TO "role_id";
--> statement-breakpoint
UPDATE "role_permission" SET "role_id" = (SELECT "id" FROM "role" WHERE "role"."name" = "role_permission"."role_id");
--> statement-breakpoint

-- Step 5: Recreate FK and PK on role_permission
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY ("role_id", "permission_id");
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permission_role_idx" ON "role_permission" USING btree ("role_id");
--> statement-breakpoint

-- Step 6: Add role_id column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role_id" text;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;
