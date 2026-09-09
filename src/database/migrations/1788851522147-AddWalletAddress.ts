import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletAddress1788851522147 implements MigrationInterface {
  name = 'AddWalletAddress1788851522147';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "wallet_address" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "wallet_address"`);
  }
}
