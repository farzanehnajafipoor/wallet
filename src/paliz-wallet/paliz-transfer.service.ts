import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PalizTransfer, PalizTransferAction, PalizTransferStatus } from './entities/paliz-transfer.entity.js';
import { PalizRequestFailedException } from './paliz-wallet.service.js';

@Injectable()
export class PalizTransferService {
  constructor(
    @InjectRepository(PalizTransfer)
    private readonly repo: Repository<PalizTransfer>,
  ) {}

  async recordPending(params: {
    paymentId: string;
    uniqueId: string;
    sequenceId: number;
    action: PalizTransferAction;
    refUniqueId?: string;
    refSequenceId?: string;
  }): Promise<PalizTransfer> {
    return this.repo.save(
      this.repo.create({
        paymentId: params.paymentId,
        uniqueId: params.uniqueId,
        sequenceId: params.sequenceId.toString(),
        action: params.action,
        refUniqueId: params.refUniqueId ?? null,
        refSequenceId: params.refSequenceId ?? null,
        status: PalizTransferStatus.PENDING,
      }),
    );
  }

  async markDelivered(id: string, response: unknown): Promise<void> {
    await this.repo.update(id, {
      status: PalizTransferStatus.DELIVERED,
      response: response as Record<string, any> | any[] | null,
    });
  }

  async markFailed(id: string, err: PalizRequestFailedException): Promise<void> {
    await this.repo.update(id, {
      status: err.deliveryStatus === 'unknown' ? PalizTransferStatus.UNKNOWN : PalizTransferStatus.FAILED,
      errorMessage: err.message,
      response: (err.cause ?? null) as Record<string, any> | any[] | null,
    });
  }

  findByUniqueId(uniqueId: string) {
    return this.repo.findOne({ where: { uniqueId } });
  }

  findPendingOrUnknown() {
    return this.repo.find({
      where: [{ status: PalizTransferStatus.PENDING }, { status: PalizTransferStatus.UNKNOWN }],
    });
  }

  async findLatestCreateByPaymentId(paymentId: string): Promise<PalizTransfer | null> {
    return this.repo.findOne({
      where: { paymentId, action: PalizTransferAction.CREATE },
      order: { createdAt: 'DESC' },
    });
  }
}