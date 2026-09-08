import { MigrationInterface, QueryRunner } from "typeorm";

export class AddField1788865459500 implements MigrationInterface {
    name = 'AddField1788865459500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizTransactionPhrase" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizTransactionPhrase"`);
    }

}
