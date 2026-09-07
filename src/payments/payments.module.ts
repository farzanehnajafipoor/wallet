import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/entities/invoice.entity.js';
import { Payment } from './entities/payment.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { Wallet } from '../wallets/entities/wallet.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Invoice, Wallet])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}