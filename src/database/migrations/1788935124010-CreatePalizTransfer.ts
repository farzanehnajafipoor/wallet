import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePalizTransfer1788935124010 implements MigrationInterface {
    name = 'CreatePalizTransfer1788935124010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."paliz_transfers_action_enum" AS ENUM('create', 'commit', 'cancel')`);
        await queryRunner.query(`CREATE TYPE "public"."paliz_transfers_status_enum" AS ENUM('pending', 'delivered', 'unknown', 'failed')`);
        await queryRunner.query(`CREATE TABLE "paliz_transfers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" character varying NOT NULL, "unique_id" character varying NOT NULL, "sequence_id" bigint NOT NULL, "action" "public"."paliz_transfers_action_enum" NOT NULL, "status" "public"."paliz_transfers_status_enum" NOT NULL DEFAULT 'pending', "ref_unique_id" character varying, "ref_sequence_id" bigint, "response" jsonb, "errorMessage" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa68d863d7b60f695f3f319e12a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_61f31ec95bd7a020bf38dd3a98" ON "paliz_transfers"  ("payment_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_63db929c867c348ebbd3bf3e6c" ON "paliz_transfers"  ("unique_id", "sequence_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_63db929c867c348ebbd3bf3e6c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61f31ec95bd7a020bf38dd3a98"`);
        await queryRunner.query(`DROP TABLE "paliz_transfers"`);
        await queryRunner.query(`DROP TYPE "public"."paliz_transfers_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."paliz_transfers_action_enum"`);
    }

}
