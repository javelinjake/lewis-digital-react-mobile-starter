import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fixtures" ADD COLUMN "formation" varchar;
  ALTER TABLE "fixtures" ADD COLUMN "squads" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fixtures" DROP COLUMN "formation";
  ALTER TABLE "fixtures" DROP COLUMN "squads";`)
}
