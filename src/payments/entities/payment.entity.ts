import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity.js';

export enum PaymentMethod {
  WALLET = 'WALLET',
  GATEWAY = 'GATEWAY',
  COMBINED = 'COMBINED',
}

export enum PaymentStatus {
  INITIATED = 'INITIATED',
  WALLET_RESERVED = 'WALLET_RESERVED',
  AWAITING_GATEWAY = 'AWAITING_GATEWAY',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  // bigint columns come back from Postgres/TypeORM as strings, not numbers —
  // typing them as string here avoids silent precision loss on large values.
  @Column({ type: 'bigint' })
  amount: string;

  @Column({ type: 'bigint', default: 0 })
  walletAmount: string;

  @Column({ type: 'bigint', default: 0 })
  gatewayAmount: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  status: PaymentStatus;

  // Gateway (Shepa or any future provider) fields
  @Column({ type: 'varchar', nullable: true })
  gatewayTransactionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  gatewayRedirectUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
