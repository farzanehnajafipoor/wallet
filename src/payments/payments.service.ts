import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';

import {
  Invoice,
  InvoiceStatus,
} from '../invoices/entities/invoice.entity.js';
import { Wallet } from '../wallets/entities/wallet.entity.js';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from './entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PalizWalletService } from '../paliz-wallet/paliz-wallet.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    private readonly dataSource: DataSource,

    private readonly palizWalletService: PalizWalletService,
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    if (dto.method !== PaymentMethod.WALLET) {
      throw new BadRequestException(
        'Only wallet payments are supported for now',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.UNPAID) {
        throw new BadRequestException('Invoice is not unpaid');
      }

      if (dto.amount !== Number(invoice.amount)) {
        throw new BadRequestException(
          'Payment amount must match invoice amount',
        );
      }

      const wallet = await manager.findOne(Wallet, {
        where: { userId: invoice.userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // if (Number(wallet.balance) < dto.amount) {
      //   throw new BadRequestException('Insufficient wallet balance');
      // }

      wallet.balance = Number(wallet.balance) - dto.amount;

      invoice.status = InvoiceStatus.PAID;

      const payment = manager.create(Payment, {
        invoiceId: invoice.id,
        method: PaymentMethod.WALLET,
        amount: dto.amount,
        walletAmount: dto.amount,
        gatewayAmount: 0,
        status: PaymentStatus.PENDING,
        palizUniqueId: randomUUID(),
        palizSequenceId: 0,
      });

      await manager.save(wallet);
      await manager.save(invoice);

      await manager.save(payment);

      const sequenceId = await this.getNextPalizSequence(
        manager,
        payment.id,
      );

      const palizResponse =
        await this.palizWalletService.createTransfer({
          unique_id: payment.palizUniqueId!,
          sequence_id: sequenceId,
          amount: dto.amount,
          callback: `http://localhost:3000/payments/paliz/callback/${payment.id}`,
          reference: `invoice:${invoice.id}`,
        });

    payment.palizTrackingId = palizResponse.tracking_id;

    await manager.save(payment);

      return {
        payment,
        palizResponse,
      };
    });
  }

  private async getNextPalizSequence(
    manager: EntityManager,
    paymentId: string,
  ): Promise<number> {
    const payment = await manager.findOne(Payment, {
      where: { id: paymentId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.palizSequenceId += 1;

    await manager.save(payment);

    return payment.palizSequenceId;
  }

  async getPalizInfo(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.palizTrackingId) {
      throw new BadRequestException(
        'Payment does not have a Paliz tracking ID',
      );
    }

    return this.palizWalletService.getTransferInfo({
      tracking_id: payment.palizTrackingId,
    });
  }
}