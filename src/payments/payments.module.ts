import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller.js';
import { PaymentOrchestratorService } from './payment-orchestrator.service.js';
import { Payment } from './entities/payment.entity.js';
import { Invoice } from '../invoices/entities/invoice.entity.js';
import { Wallet } from '../wallets/entities/wallet.entity.js';
import { PalizWalletModule } from '../paliz-wallet/paliz-wallet.module.js';
import { PaymentGatewayModule } from '../payment-gateway/payment-gateway.module.js';
import { WalletsModule } from '../wallets/wallets.module.js';
import { PalizPaymentService } from './paliz-payment.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Invoice, Wallet]),
    PalizWalletModule,
    PaymentGatewayModule,
    WalletsModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentOrchestratorService, PalizPaymentService],
  exports: [PaymentOrchestratorService],
})
export class PaymentsModule {}