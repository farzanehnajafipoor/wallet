import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPalizFieldsToPayments1788784752553 implements MigrationInterface {
    name = 'AddPalizFieldsToPayments1788784752553'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizUniqueId" character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "UQ_b5ad43c391855a679bf881c2782" UNIQUE ("palizUniqueId")`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizSequenceId" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizSequenceId"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "UQ_b5ad43c391855a679bf881c2782"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizUniqueId"`);
    }

}
