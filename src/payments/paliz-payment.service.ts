import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { PalizWalletService } from '../paliz-wallet/paliz-wallet.service.js';

@Injectable()
export class PalizPaymentService {
  constructor(
    private readonly palizWalletService: PalizWalletService,
  ) {}

  async createTransfer(
    manager: EntityManager,
    payment: Payment,
    data: {
      amount: number;
      invoiceId: string;
      callback: string;
    },
  ) {
    const sequenceId = await this.nextSequence(
      manager,
      payment,
    );

    const response =
      await this.palizWalletService.createTransfer({
        unique_id: payment.palizUniqueId!,
        sequence_id: sequenceId,
        amount: data.amount,
        callback: data.callback,
        reference: `invoice:${data.invoiceId}`,
      });

      console.log(
        '[Payment][PALIZ] CREATE RESPONSE:',
        JSON.stringify(response, null, 2),
        );

    payment.palizTrackingId =
      response.tracking_id;

    await manager.save(payment);

    return response;
  }

  async getTransferInfo(
    manager: EntityManager,
    payment: Payment,
  ) {
    await this.nextSequence(manager, payment);

    const response =
    await this.palizWalletService.getTransferInfo({
      tracking_id: payment.palizTrackingId!,
    });

    payment.palizTransactionPhrase =
        response.data.transaction_phrase;

    await manager.save(payment);

    return response;
  }

  async commitTransfer(
    manager: EntityManager,
    payment: Payment,
  ) {
    const sequenceId = await this.nextSequence(
      manager,
      payment,
    );

    return this.palizWalletService.commitTransfer({
      unique_id: payment.palizUniqueId!,
      sequence_id: sequenceId,
      transaction_phrase: payment.palizTransactionPhrase!,
    });
  }

  async cancelTransfer(
    manager: EntityManager,
    payment: Payment,
  ) {
    const sequenceId = await this.nextSequence(
      manager,
      payment,
    );

    return this.palizWalletService.cancelTransfer({
      unique_id: payment.palizUniqueId!,
      sequence_id: sequenceId,
      transaction_phrase: payment.palizTransactionPhrase!,
    });
  }

  private async nextSequence(
    manager: EntityManager,
    payment: Payment,
  ): Promise<number> {
    payment.palizLastSequenceId += 1;

    await manager.save(payment);

    return payment.palizLastSequenceId;
  }
}