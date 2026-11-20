import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import catalogue from './20261108_204346_catalogue.json' with { type: 'json' }

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_players_position" AS ENUM('GK', 'DEF', 'MID', 'FWD');
  CREATE TYPE "public"."enum_players_alt_position" AS ENUM('GK', 'DEF', 'MID', 'FWD');
  CREATE TYPE "public"."enum_players_rarity" AS ENUM('grassroots', 'semipro', 'pro', 'star', 'legend');
  CREATE TYPE "public"."enum_cards_source" AS ENUM('starter', 'pack', 'merge', 'arcade');
  CREATE TYPE "public"."enum_fixtures_kind" AS ENUM('league', 'debut');
  CREATE TYPE "public"."enum_fixtures_result" AS ENUM('win', 'draw', 'loss');
  CREATE TYPE "public"."enum_ledger_currency" AS ENUM('coins', 'gems', 'tokens');
  CREATE TABLE "players" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"catalogue_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"nation" numeric NOT NULL,
  	"position" "enum_players_position" NOT NULL,
  	"alt_position" "enum_players_alt_position",
  	"rarity" "enum_players_rarity" NOT NULL,
  	"rating" numeric NOT NULL,
  	"sprite" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clubs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"client_mutation_id" varchar,
  	"name" varchar NOT NULL,
  	"crest" numeric NOT NULL,
  	"kit_primary" varchar NOT NULL,
  	"kit_secondary" varchar NOT NULL,
  	"state" jsonb NOT NULL,
  	"version" numeric DEFAULT 0 NOT NULL,
  	"tier" numeric,
  	"points" numeric,
  	"coins" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"client_mutation_id" varchar,
  	"player_id" varchar NOT NULL,
  	"stars" numeric DEFAULT 1 NOT NULL,
  	"trained" numeric DEFAULT 0 NOT NULL,
  	"source" "enum_cards_source" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fixtures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"client_mutation_id" varchar,
  	"no" numeric NOT NULL,
  	"kind" "enum_fixtures_kind" NOT NULL,
  	"tier" numeric NOT NULL,
  	"kickoff_at" numeric NOT NULL,
  	"rival" jsonb NOT NULL,
  	"goals_for" numeric NOT NULL,
  	"goals_against" numeric NOT NULL,
  	"result" "enum_fixtures_result" NOT NULL,
  	"points" numeric NOT NULL,
  	"coins" numeric NOT NULL,
  	"events" jsonb NOT NULL,
  	"warmup_bonus" numeric NOT NULL,
  	"promoted_to" numeric,
  	"config_version" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ledger" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"client_mutation_id" varchar,
  	"currency" "enum_ledger_currency" NOT NULL,
  	"amount" numeric NOT NULL,
  	"balance" numeric NOT NULL,
  	"reason" varchar NOT NULL,
  	"ref" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "game_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"config" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  DROP INDEX "owner_clientMutationId_2_idx";
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1794170626770;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "players_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clubs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cards_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fixtures_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ledger_id" integer;
  ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ledger" ADD CONSTRAINT "ledger_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "players_catalogue_id_idx" ON "players" USING btree ("catalogue_id");
  CREATE INDEX "players_updated_at_idx" ON "players" USING btree ("updated_at");
  CREATE INDEX "players_created_at_idx" ON "players" USING btree ("created_at");
  CREATE INDEX "clubs_owner_idx" ON "clubs" USING btree ("owner_id");
  CREATE INDEX "clubs_client_mutation_id_idx" ON "clubs" USING btree ("client_mutation_id");
  CREATE INDEX "clubs_tier_idx" ON "clubs" USING btree ("tier");
  CREATE INDEX "clubs_updated_at_idx" ON "clubs" USING btree ("updated_at");
  CREATE INDEX "clubs_created_at_idx" ON "clubs" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_clientMutationId_2_idx" ON "clubs" USING btree ("owner_id","client_mutation_id");
  CREATE UNIQUE INDEX "owner_idx" ON "clubs" USING btree ("owner_id");
  CREATE INDEX "cards_owner_idx" ON "cards" USING btree ("owner_id");
  CREATE INDEX "cards_client_mutation_id_idx" ON "cards" USING btree ("client_mutation_id");
  CREATE INDEX "cards_player_id_idx" ON "cards" USING btree ("player_id");
  CREATE INDEX "cards_updated_at_idx" ON "cards" USING btree ("updated_at");
  CREATE INDEX "cards_created_at_idx" ON "cards" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_clientMutationId_3_idx" ON "cards" USING btree ("owner_id","client_mutation_id");
  CREATE INDEX "fixtures_owner_idx" ON "fixtures" USING btree ("owner_id");
  CREATE INDEX "fixtures_client_mutation_id_idx" ON "fixtures" USING btree ("client_mutation_id");
  CREATE INDEX "fixtures_updated_at_idx" ON "fixtures" USING btree ("updated_at");
  CREATE INDEX "fixtures_created_at_idx" ON "fixtures" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_clientMutationId_4_idx" ON "fixtures" USING btree ("owner_id","client_mutation_id");
  CREATE UNIQUE INDEX "owner_no_idx" ON "fixtures" USING btree ("owner_id","no");
  CREATE INDEX "ledger_owner_idx" ON "ledger" USING btree ("owner_id");
  CREATE INDEX "ledger_client_mutation_id_idx" ON "ledger" USING btree ("client_mutation_id");
  CREATE INDEX "ledger_updated_at_idx" ON "ledger" USING btree ("updated_at");
  CREATE INDEX "ledger_created_at_idx" ON "ledger" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_clientMutationId_5_idx" ON "ledger" USING btree ("owner_id","client_mutation_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_players_fk" FOREIGN KEY ("players_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clubs_fk" FOREIGN KEY ("clubs_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cards_fk" FOREIGN KEY ("cards_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fixtures_fk" FOREIGN KEY ("fixtures_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ledger_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledger"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "owner_clientMutationId_6_idx" ON "notes" USING btree ("owner_id","client_mutation_id");
  CREATE INDEX "payload_locked_documents_rels_players_id_idx" ON "payload_locked_documents_rels" USING btree ("players_id");
  CREATE INDEX "payload_locked_documents_rels_clubs_id_idx" ON "payload_locked_documents_rels" USING btree ("clubs_id");
  CREATE INDEX "payload_locked_documents_rels_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("cards_id");
  CREATE INDEX "payload_locked_documents_rels_fixtures_id_idx" ON "payload_locked_documents_rels" USING btree ("fixtures_id");
  CREATE INDEX "payload_locked_documents_rels_ledger_id_idx" ON "payload_locked_documents_rels" USING btree ("ledger_id");`)

  // The launch catalogue: 200 invented players, generated once by `generateCatalogue(DEFAULT_CONFIG,
  // 'pixel-pitch-catalogue')` and frozen here, so a later change to the generator never changes this migration.
  // Editable in the admin afterwards; cards refer to `catalogueId`, which must never change.
  for (const player of catalogue as Array<{ id: string, name: string, nation: number, position: 'GK' | 'DEF' | 'MID' | 'FWD', altPosition?: 'GK' | 'DEF' | 'MID' | 'FWD', rarity: 'grassroots' | 'semipro' | 'pro' | 'star' | 'legend', rating: number, sprite: Record<string, number> }>) {
    await payload.create({
      collection: 'players',
      data: { catalogueId: player.id, name: player.name, nation: player.nation, position: player.position, altPosition: player.altPosition, rarity: player.rarity, rating: player.rating, sprite: { ...player.sprite } },
      depth: 0,
      overrideAccess: true,
      req,
    })
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "players" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clubs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fixtures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ledger" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "game_config" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "players" CASCADE;
  DROP TABLE "clubs" CASCADE;
  DROP TABLE "cards" CASCADE;
  DROP TABLE "fixtures" CASCADE;
  DROP TABLE "ledger" CASCADE;
  DROP TABLE "game_config" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_players_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clubs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cards_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_fixtures_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ledger_fk";
  
  DROP INDEX "owner_clientMutationId_6_idx";
  DROP INDEX "payload_locked_documents_rels_players_id_idx";
  DROP INDEX "payload_locked_documents_rels_clubs_id_idx";
  DROP INDEX "payload_locked_documents_rels_cards_id_idx";
  DROP INDEX "payload_locked_documents_rels_fixtures_id_idx";
  DROP INDEX "payload_locked_documents_rels_ledger_id_idx";
  ALTER TABLE "rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1794148369925;
  CREATE UNIQUE INDEX "owner_clientMutationId_2_idx" ON "notes" USING btree ("owner_id","client_mutation_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "players_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clubs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cards_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fixtures_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ledger_id";
  DROP TYPE "public"."enum_players_position";
  DROP TYPE "public"."enum_players_alt_position";
  DROP TYPE "public"."enum_players_rarity";
  DROP TYPE "public"."enum_cards_source";
  DROP TYPE "public"."enum_fixtures_kind";
  DROP TYPE "public"."enum_fixtures_result";
  DROP TYPE "public"."enum_ledger_currency";`)
}
