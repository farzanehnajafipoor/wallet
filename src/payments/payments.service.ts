import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

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

    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    wallet.balance = Number(wallet.balance) - dto.amount;

    invoice.status = InvoiceStatus.PAID;

    const payment = manager.create(Payment, {
      invoiceId: invoice.id,
      method: PaymentMethod.WALLET,
      amount: dto.amount,
      walletAmount: dto.amount,
      gatewayAmount: 0,
      status: PaymentStatus.SUCCESS,
    });

    await manager.save(wallet);
    await manager.save(invoice);

    return manager.save(payment);
  });
}
}