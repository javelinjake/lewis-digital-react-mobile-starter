import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_fixtures_kind" ADD VALUE 'friendly';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fixtures" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_fixtures_kind";
  CREATE TYPE "public"."enum_fixtures_kind" AS ENUM('league', 'debut');
  ALTER TABLE "fixtures" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_fixtures_kind" USING "kind"::"public"."enum_fixtures_kind";`)
}
