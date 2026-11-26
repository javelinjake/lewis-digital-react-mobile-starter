import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "challenge_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"client_mutation_id" varchar,
  	"day" numeric NOT NULL,
  	"week" numeric NOT NULL,
  	"cabinet" varchar NOT NULL,
  	"score" numeric NOT NULL,
  	"club_name" varchar NOT NULL,
  	"crest" numeric NOT NULL,
  	"kit_primary" varchar NOT NULL,
  	"kit_secondary" varchar NOT NULL,
  	"flagged" varchar,
  	"reviewed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "owner_clientMutationId_6_idx";
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1795706752825;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "challenge_entries_id" integer;
  ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "challenge_entries_owner_idx" ON "challenge_entries" USING btree ("owner_id");
  CREATE INDEX "challenge_entries_client_mutation_id_idx" ON "challenge_entries" USING btree ("client_mutation_id");
  CREATE INDEX "challenge_entries_day_idx" ON "challenge_entries" USING btree ("day");
  CREATE INDEX "challenge_entries_week_idx" ON "challenge_entries" USING btree ("week");
  CREATE INDEX "challenge_entries_updated_at_idx" ON "challenge_entries" USING btree ("updated_at");
  CREATE INDEX "challenge_entries_created_at_idx" ON "challenge_entries" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_clientMutationId_6_idx" ON "challenge_entries" USING btree ("owner_id","client_mutation_id");
  CREATE UNIQUE INDEX "owner_day_idx" ON "challenge_entries" USING btree ("owner_id","day");
  CREATE INDEX "day_score_idx" ON "challenge_entries" USING btree ("day","score");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_challenge_entries_fk" FOREIGN KEY ("challenge_entries_id") REFERENCES "public"."challenge_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "owner_clientMutationId_7_idx" ON "notes" USING btree ("owner_id","client_mutation_id");
  CREATE INDEX "payload_locked_documents_rels_challenge_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("challenge_entries_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "challenge_entries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "challenge_entries" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_challenge_entries_fk";
  
  DROP INDEX "owner_clientMutationId_7_idx";
  DROP INDEX "payload_locked_documents_rels_challenge_entries_id_idx";
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1795690872819;
  CREATE UNIQUE INDEX "owner_clientMutationId_6_idx" ON "notes" USING btree ("owner_id","client_mutation_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "challenge_entries_id";`)
}
