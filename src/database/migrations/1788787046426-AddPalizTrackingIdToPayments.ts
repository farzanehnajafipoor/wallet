import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPalizTrackingIdToPayments1788787046426 implements MigrationInterface {
    name = 'AddPalizTrackingIdToPayments1788787046426'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "palizTrackingId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "palizTrackingId"`);
    }

}
