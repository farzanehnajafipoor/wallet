import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  NOT_FULFILLED = 'NOT_FULFILLED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.UNPAID,
  })
  status: InvoiceStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}