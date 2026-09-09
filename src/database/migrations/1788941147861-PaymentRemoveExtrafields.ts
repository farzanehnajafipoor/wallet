import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentRemoveExtrafields1788941147861 implements MigrationInterface {
    name = 'PaymentRemoveExtrafields1788941147861'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "UQ_b5ad43c391855a679bf881c2782"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizUniqueId"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizLastSequenceId"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizTrackingId"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizTransactionPhrase"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizTransactionPhrase" character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizTrackingId" character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizLastSequenceId" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizUniqueId" character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "UQ_b5ad43c391855a679bf881c2782" UNIQUE ("palizUniqueId")`);
    }

}
