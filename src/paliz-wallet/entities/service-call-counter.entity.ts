import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('service_call_counters')
export class ServiceCallCounter {
  @PrimaryColumn()
  serviceId: string;

  @Column({ type: 'bigint', default: 0 })
  count: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
