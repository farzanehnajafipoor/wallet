import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceCounter1788931416681 implements MigrationInterface {
  name = 'CreateServiceCounter1788931416681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "service_call_counters" ("serviceId" character varying NOT NULL, "count" bigint NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_13aea5af905488b8ad321d0e46f" PRIMARY KEY ("serviceId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "service_call_counters"`);
  }
}
