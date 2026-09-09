import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PalizWalletService,
  PalizRequestFailedException,
} from '../paliz-wallet/paliz-wallet.service.js';
import { PalizCallCounterService } from '../paliz-wallet/paliz-call-counter.service.js';
import { PalizTransferService } from '../paliz-wallet/paliz-transfer.service.js';
import {
  PalizTransferAction,
  PalizTransferStatus,
} from '../paliz-wallet/entities/paliz-transfer.entity.js';

@Injectable()
export class PalizPaymentService {
  constructor(
    private readonly palizWalletService: PalizWalletService,
    private readonly callCounterService: PalizCallCounterService,
    private readonly palizTransferService: PalizTransferService,
  ) {}

  async createTransfer(params: {
    paymentId: string;
    amount: number;
    callback: string;
    reference?: string;
    reverse?: boolean;
  }) {
    const { serviceId } = this.palizWalletService.getWalletConfig();
    const uniqueId = randomUUID();
    const sequenceId = await this.callCounterService.incrementAndGet(serviceId);

    const record = await this.palizTransferService.recordPending({
      paymentId: params.paymentId,
      uniqueId,
      sequenceId,
      action: PalizTransferAction.CREATE,
    });

    try {
      const result = await this.palizWalletService.createTransfer({
        unique_id: uniqueId,
        sequence_id: Number(sequenceId),
        amount: params.amount,
        callback: params.callback,
        reference: params.reference,
        reverse: params.reverse,
      });
      await this.palizTransferService.markDelivered(record.id, result);
      return { ...result, uniqueId, sequenceId };
    } catch (err) {
      if (err instanceof PalizRequestFailedException) {
        await this.palizTransferService.markFailed(record.id, err);
      }
      throw err;
    }
  }

  async commitTransfer(params: { paymentId: string; transactionPhrase: string }) {
    const createRecord = await this.palizTransferService.findLatestCreateByPaymentId(
      params.paymentId,
    );

    if (!createRecord) {
      throw new Error(`No Paliz create-transfer record found for payment ${params.paymentId}`);
    }

    if (createRecord.status !== PalizTransferStatus.DELIVERED) {
      throw new Error(
        `Cannot commit: create-transfer for payment ${params.paymentId} is in status ${createRecord.status}`,
      );
    }

    const { serviceId } = this.palizWalletService.getWalletConfig();
    const uniqueId = randomUUID();
    const sequenceId = await this.callCounterService.incrementAndGet(serviceId);

    const record = await this.palizTransferService.recordPending({
      paymentId: params.paymentId,
      uniqueId,
      sequenceId,
      action: PalizTransferAction.COMMIT,
      refUniqueId: createRecord.uniqueId,
      refSequenceId: createRecord.sequenceId,
    });

    try {
      const result = await this.palizWalletService.commitTransfer({
        unique_id: uniqueId,
        sequence_id: Number(sequenceId),
        transaction_phrase: params.transactionPhrase,
        create_unique_id: createRecord.uniqueId,
        create_sequence_id: Number(createRecord.sequenceId),
      });
      await this.palizTransferService.markDelivered(record.id, result);
      return result;
    } catch (err) {
      if (err instanceof PalizRequestFailedException) {
        await this.palizTransferService.markFailed(record.id, err);
      }
      throw err;
    }
  }

  async cancelTransfer(params: { paymentId: string; transactionPhrase: string }) {
    const createRecord = await this.palizTransferService.findLatestCreateByPaymentId(
      params.paymentId,
    );

    if (!createRecord) {
      throw new Error(`No Paliz create-transfer record found for payment ${params.paymentId}`);
    }

    if (createRecord.status !== PalizTransferStatus.DELIVERED) {
      throw new Error(
        `Cannot cancel: create-transfer for payment ${params.paymentId} is in status ${createRecord.status}`,
      );
    }

    const { serviceId } = this.palizWalletService.getWalletConfig();
    const uniqueId = randomUUID();
    const sequenceId = Number(await this.callCounterService.incrementAndGet(serviceId));

    const record = await this.palizTransferService.recordPending({
      paymentId: params.paymentId,
      uniqueId,
      sequenceId,
      action: PalizTransferAction.CANCEL,
      refUniqueId: createRecord.uniqueId,
      refSequenceId: createRecord.sequenceId,
    });

    try {
      const result = await this.palizWalletService.cancelTransfer({
        unique_id: uniqueId,
        sequence_id: sequenceId,
        transaction_phrase: params.transactionPhrase,
        create_unique_id: createRecord.uniqueId,
        create_sequence_id: Number(createRecord.sequenceId),
      });
      await this.palizTransferService.markDelivered(record.id, result);
      return result;
    } catch (err) {
      if (err instanceof PalizRequestFailedException) {
        await this.palizTransferService.markFailed(record.id, err);
      }
      throw err;
    }
  }

  async reconcile(paymentId: string) {
    const record = await this.palizTransferService.findLatestCreateByPaymentId(paymentId);
    if (!record) return null;

    const info = await this.palizWalletService.getTransferInfo({
      tracking_id: (record.response as Record<string, any>)?.tracking_id,
    });

    // Adjust this based on Paliz's actual response shape for transfer status.
    await this.palizTransferService.markDelivered(record.id, info);
    return info;
  }

  getBalance(address: string) {
    return this.palizWalletService.getBalance({ address });
  }

  async getTransferInfo(params: { paymentId: string }) {
    const createRecord = await this.palizTransferService.findLatestCreateByPaymentId(
      params.paymentId,
    );

    if (!createRecord) {
      throw new Error(`No Paliz create-transfer record found for payment ${params.paymentId}`);
    }

    // Read-only — does NOT touch the counter or write a new PalizTransfer row.
    return this.palizWalletService.getTransferInfo({
      tracking_id: (createRecord.response as Record<string, any>)?.tracking_id,
    });
  }
}
