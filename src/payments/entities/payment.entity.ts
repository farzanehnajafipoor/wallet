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
  PENDING = 'PENDING',
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

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'bigint', default: 0 })
  walletAmount: number;

  @Column({ type: 'bigint', default: 0 })
  gatewayAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  gatewayTransactionId: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  palizUniqueId: string | null;

  @Column({ type: 'varchar', nullable: true })
  palizTrackingId: string | null;

  @Column({ type: 'integer', default: 0 })
  palizSequenceId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}