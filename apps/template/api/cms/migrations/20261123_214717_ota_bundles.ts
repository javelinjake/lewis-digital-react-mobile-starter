import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "app_bundles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"app_id" varchar NOT NULL,
  	"native_version" varchar NOT NULL,
  	"version" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"checksum" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1795470437810;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "app_bundles_id" integer;
  CREATE INDEX "app_bundles_updated_at_idx" ON "app_bundles" USING btree ("updated_at");
  CREATE INDEX "app_bundles_created_at_idx" ON "app_bundles" USING btree ("created_at");
  CREATE INDEX "appId_nativeVersion_idx" ON "app_bundles" USING btree ("app_id","native_version");
  CREATE UNIQUE INDEX "appId_version_idx" ON "app_bundles" USING btree ("app_id","version");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_app_bundles_fk" FOREIGN KEY ("app_bundles_id") REFERENCES "public"."app_bundles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_app_bundles_id_idx" ON "payload_locked_documents_rels" USING btree ("app_bundles_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "app_bundles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "app_bundles" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_app_bundles_fk";
  
  DROP INDEX "payload_locked_documents_rels_app_bundles_id_idx";
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1794148369925;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "app_bundles_id";`)
}
