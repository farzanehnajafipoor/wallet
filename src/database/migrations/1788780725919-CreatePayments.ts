import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePayments1788780725919 implements MigrationInterface {
    name = 'CreatePayments1788780725919'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('WALLET', 'GATEWAY', 'COMBINED')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "amount" bigint NOT NULL, "walletAmount" bigint NOT NULL DEFAULT '0', "gatewayAmount" bigint NOT NULL DEFAULT '0', "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "gatewayTransactionId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_43d19956aeab008b49e0804c145" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_43d19956aeab008b49e0804c145"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    }

}
