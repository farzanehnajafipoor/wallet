import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameField1788865071438 implements MigrationInterface {
    name = 'RenameField1788865071438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" RENAME COLUMN "palizSequenceId" TO "palizLastSequenceId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" RENAME COLUMN "palizLastSequenceId" TO "palizSequenceId"`);
    }

}
