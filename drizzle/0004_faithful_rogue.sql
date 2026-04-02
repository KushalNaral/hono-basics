CREATE TABLE "role" (
	"name" text PRIMARY KEY NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_role_name_fk" FOREIGN KEY ("role") REFERENCES "public"."role"("name") ON DELETE cascade ON UPDATE no action;