import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PalizTransferStatus {
  PENDING = 'pending',       // written before the call, not yet confirmed
  DELIVERED = 'delivered',   // Paliz responded successfully
  UNKNOWN = 'unknown',       // no response received — needs reconciliation
  FAILED = 'failed',         // Paliz explicitly rejected, or failed before sending
}

export enum PalizTransferAction {
  CREATE = 'create',
  COMMIT = 'commit',
  CANCEL = 'cancel',
}

@Entity('paliz_transfers')
@Index(['uniqueId', 'sequenceId'], { unique: true })
export class PalizTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id' })
  @Index()
  paymentId: string;

  @Column({ name: 'unique_id' , type: 'varchar'})
  uniqueId: string;

  @Column({ name: 'sequence_id', type: 'bigint' })
  sequenceId: string; 

  @Column({ type: 'enum', enum: PalizTransferAction })
  action: PalizTransferAction;

  @Column({ type: 'enum', enum: PalizTransferStatus, default: PalizTransferStatus.PENDING })
  status: PalizTransferStatus;

  @Column({ name: 'ref_unique_id', type: 'varchar',  nullable: true })
  refUniqueId: string | null;

  @Column({ name: 'ref_sequence_id', type: 'bigint', nullable: true })
  refSequenceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, any> | any[] | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}