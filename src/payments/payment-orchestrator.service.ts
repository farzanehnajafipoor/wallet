import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity.js';
import { Wallet } from '../wallets/entities/wallet.entity.js';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity.js';
import { PAYMENT_GATEWAY } from '../payment-gateway/payment-gateway.interface.js';
import type { PaymentGateway } from '../payment-gateway/payment-gateway.interface.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { PalizPaymentService } from './paliz-payment.service.js';
import { PalizWalletService } from '../paliz-wallet/paliz-wallet.service.js';

@Injectable()
export class PaymentOrchestratorService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly palizPaymentService: PalizPaymentService,
    private readonly palizWalletService: PalizWalletService,
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway,
    private readonly configService: ConfigService,
    private readonly walletsService: WalletsService,
  ) {}

  async pay(invoiceId: string, selectedMethod: PaymentMethod) {
    console.log(`[Payment] START pay | invoiceId=${invoiceId} | method=${selectedMethod}`);

    console.log(`[Payment] Loading invoice | invoiceId=${invoiceId}`);

    const invoice = await this.dataSource.manager.findOne(Invoice, {
      where: { id: invoiceId },
    });

    if (!invoice) {
      console.log(`[Payment] ERROR invoice not found | invoiceId=${invoiceId}`);

      throw new NotFoundException('Invoice not found');
    }

    console.log(`[Payment] Invoice found | status=${invoice.status} | amount=${invoice.amount}`);

    if (invoice.status !== InvoiceStatus.UNPAID) {
      console.log(`[Payment] ERROR invoice is not payable | status=${invoice.status}`);

      throw new BadRequestException('Invoice is not payable');
    }

    console.log(`[Payment] Refreshing wallet balance | userId=${invoice.userId}`);

    const walletBalance = await this.walletsService.refreshWalletBalance(invoice.userId);

    console.log(`[Payment] Wallet balance refreshed | balance=${walletBalance}`);

    console.log(`[Payment] Starting DB transaction | invoiceId=${invoiceId}`);

    return this.dataSource.transaction(async (manager) => {
      console.log(`[Payment] Transaction started | invoiceId=${invoiceId}`);

      console.log(`[Payment] Locking invoice | invoiceId=${invoiceId}`);

      const lockedInvoice = await manager.findOne(Invoice, {
        where: { id: invoiceId },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!lockedInvoice) {
        console.log(`[Payment] ERROR locked invoice not found | invoiceId=${invoiceId}`);

        throw new NotFoundException('Invoice not found');
      }

      console.log(`[Payment] Invoice locked | status=${lockedInvoice.status}`);

      if (lockedInvoice.status !== InvoiceStatus.UNPAID) {
        console.log(`[Payment] ERROR invoice became non-payable | status=${lockedInvoice.status}`);

        throw new BadRequestException('Invoice is not payable');
      }

      console.log(`[Payment] Locking wallet | userId=${lockedInvoice.userId}`);

      const wallet = await manager.findOne(Wallet, {
        where: {
          userId: lockedInvoice.userId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!wallet) {
        console.log(`[Payment] ERROR wallet not found | userId=${lockedInvoice.userId}`);

        throw new NotFoundException('Wallet not found');
      }

      console.log(`[Payment] Wallet locked | balance=${wallet.balance}`);

      const invoiceAmount = BigInt(lockedInvoice.amount);

      const currentWalletBalance = BigInt(walletBalance);

      let walletAmount = 0n;
      let gatewayAmount = 0n;

      switch (selectedMethod) {
        case PaymentMethod.WALLET:
          walletAmount = invoiceAmount;
          gatewayAmount = 0n;
          break;

        case PaymentMethod.GATEWAY:
          walletAmount = 0n;
          gatewayAmount = invoiceAmount;
          break;

        case PaymentMethod.COMBINED:
          walletAmount =
            currentWalletBalance < invoiceAmount ? currentWalletBalance : invoiceAmount;

          gatewayAmount = invoiceAmount - walletAmount;
          break;
      }

      console.log(
        `[Payment] Amount calculation | invoice=${invoiceAmount} | wallet=${walletAmount} | gateway=${gatewayAmount}`,
      );

      console.log(`[Payment] Validating method | method=${selectedMethod}`);

      this.validatePaymentMethod(selectedMethod, walletAmount, gatewayAmount);

      console.log(`[Payment] Payment method validated`);

      console.log(`[Payment] Looking for existing payment | invoiceId=${lockedInvoice.id}`);

      let payment = await manager.findOne(Payment, {
        where: {
          invoiceId: lockedInvoice.id,
        },
      });

      if (payment) {
        console.log(
          `[Payment] Existing payment found | paymentId=${payment.id} | status=${payment.status} `,
        );
      } else {
        console.log(`[Payment] No existing payment found`);
      }

      if (payment?.status === PaymentStatus.SUCCESS) {
        console.log(`[Payment] Payment already SUCCESS | paymentId=${payment.id}`);

        return {
          payment,
          redirectUrl: null,
        };
      }

      if (payment?.status === PaymentStatus.AWAITING_GATEWAY) {
        console.log(`[Payment] Payment already AWAITING_GATEWAY | paymentId=${payment.id}`);

        return {
          payment,
          redirectUrl: payment.gatewayRedirectUrl ?? null,
        };
      }

      if (!payment) {
        console.log(`[Payment] Creating payment`);

        payment = manager.create(Payment, {
          invoiceId: lockedInvoice.id,
          method: selectedMethod,
          amount: invoiceAmount.toString(),

          walletAmount: walletAmount.toString(),

          gatewayAmount: gatewayAmount.toString(),

          status: PaymentStatus.INITIATED,

          palizUniqueId: walletAmount > 0n ? `paliz-${lockedInvoice.id}` : null,

          palizLastSequenceId: 0,
        });

        await manager.save(payment);

        console.log(
          `[Payment] Payment created | paymentId=${payment.id} | status=${payment.status} `,
        );
      }

      if (selectedMethod === PaymentMethod.WALLET) {
        console.log(`[Payment] FLOW=WALLET | paymentId=${payment.id}`);

        return this.handleWalletPayment(manager, payment, lockedInvoice, wallet, walletAmount);
      }

      if (selectedMethod === PaymentMethod.COMBINED) {
        console.log(`[Payment] FLOW=COMBINED | paymentId=${payment.id}`);

        return this.handleCombinedPayment(
          manager,
          payment,
          lockedInvoice,
          wallet,
          walletAmount,
          gatewayAmount,
        );
      }

      console.log(`[Payment] FLOW=GATEWAY | paymentId=${payment.id}`);

      return this.handleGatewayPayment(manager, payment, lockedInvoice, gatewayAmount);
    });
  }

  private async handleWalletPayment(
    manager: EntityManager,
    payment: Payment,
    invoice: Invoice,
    wallet: Wallet,
    walletAmount: bigint,
  ) {
    console.log(`[Payment][WALLET] START | paymentId=${payment.id}`);

    const oldWalletBalance = BigInt(wallet.balance);
    const newWalletBalance = oldWalletBalance - walletAmount;

    console.log(
      `[Payment][WALLET] Reserving wallet | oldBalance=${oldWalletBalance} | amount=${walletAmount} | newBalance=${newWalletBalance}`,
    );

    wallet.balance = newWalletBalance.toString();
    await manager.save(wallet);

    console.log(`[Payment][WALLET] Wallet balance updated to new`);

    console.log(`[Payment][PALIZ] CREATE START | paymentId=${payment.id}`);

    const createResult = await this.palizPaymentService.createTransfer({
      paymentId: payment.id,
      amount: Number(walletAmount),
      callback: `${this.callbackBase()}/payments/paliz/callback/${payment.id}`,
      reference: invoice.id,
      reverse: false,
    });

    console.log(`[Payment][PALIZ] CREATE RESULT | result=${createResult} `);

    console.log(`[Payment][PALIZ] Waiting 1500ms before INFO | paymentId=${payment.id}`);
    await this.sleep(1500);
    console.log(`[Payment][PALIZ] Wait completed | paymentId=${payment.id}`);

    console.log(`[Payment][PALIZ] INFO START | paymentId=${payment.id}`);

    const info = await this.palizPaymentService.getTransferInfo({ paymentId: payment.id });

    console.log(
      `[Payment][PALIZ] INFO RESPONSE | paymentId=${payment.id} | status=${info?.data?.status}`,
    );

    if (info?.data?.status === 'firstcommit') {
      console.log(`[Payment][PALIZ] STATUS=firstcommit → COMMIT | paymentId=${payment.id}`);

      await this.palizPaymentService.commitTransfer({
        paymentId: payment.id,
        transactionPhrase: info.data.transaction_phrase,
      });

      console.log(`[Payment][PALIZ] COMMIT SUCCESS | paymentId=${payment.id}`);

      payment.status = PaymentStatus.SUCCESS;
      invoice.status = InvoiceStatus.PAID;

      console.log(`[Payment][WALLET] SUCCESS | paymentId=${payment.id} | invoiceId=${invoice.id}`);
    } else {
      console.log(
        `[Payment][PALIZ] STATUS=${info?.data?.status} → CANCEL | paymentId=${payment.id}`,
      );

      await this.palizPaymentService.cancelTransfer({
        paymentId: payment.id,
        transactionPhrase: info?.data?.transaction_phrase,
      });

      console.log(`[Payment][PALIZ] CANCEL SUCCESS | paymentId=${payment.id}`);

      wallet.balance = oldWalletBalance.toString();
      await manager.save(wallet);

      console.log(`[Payment][WALLET] Wallet balance updated to old`);
      payment.status = PaymentStatus.FAILED;

      console.log(`[Payment][WALLET] FAILED | paymentId=${payment.id}`);
    }

    await manager.save(payment);
    await manager.save(invoice);

    console.log(
      `[Payment][WALLET] END | paymentId=${payment.id} | paymentStatus=${payment.status} | invoiceStatus=${invoice.status}`,
    );

    return { payment, redirectUrl: null };
  }

  private async handleCombinedPayment(
    manager: EntityManager,
    payment: Payment,
    invoice: Invoice,
    wallet: Wallet,
    walletAmount: bigint,
    gatewayAmount: bigint,
  ) {
    console.log(`[Payment][COMBINED] START | paymentId=${payment.id}`);

    const oldWalletBalance = BigInt(wallet.balance);

    const newWalletBalance = oldWalletBalance - walletAmount;

    console.log(
      `[Payment][COMBINED] Reserving wallet | oldBalance=${oldWalletBalance} | amount=${walletAmount} | newBalance=${newWalletBalance}`,
    );

    console.log(`[Payment][PALIZ] CREATE START | paymentId=${payment.id} `);

    const createResult = await this.palizPaymentService.createTransfer({
      paymentId: payment.id,
      amount: Number(walletAmount),
      callback: `${this.callbackBase()}/payments/paliz/callback/${payment.id}`,
      reference: invoice.id,
      reverse: false,
    });

    console.log(`[Payment][PALIZ] CREATE RESULT | result=${createResult}`);

    payment.status = PaymentStatus.WALLET_RESERVED;

    await manager.save(payment);

    console.log(`[Payment][COMBINED] WALLET_RESERVED | paymentId=${payment.id}`);

    console.log(
      `[Payment][GATEWAY] CREATE START | paymentId=${payment.id} | amount=${gatewayAmount}`,
    );

    const gatewayRequest = await this.paymentGateway.createPaymentRequest({
      idempotencyKey: `gateway-${payment.id}`,

      amount: Number(gatewayAmount),

      callback: `${this.callbackBase()}/payments/gateway/callback/${payment.id}`,
    });

    console.log(
      `[Payment][GATEWAY] CREATE SUCCESS | paymentId=${payment.id} | authority=${gatewayRequest.authority}`,
    );

    payment.gatewayTransactionId = gatewayRequest.authority;

    payment.gatewayRedirectUrl = gatewayRequest.redirectUrl;

    payment.status = PaymentStatus.AWAITING_GATEWAY;

    await manager.save(payment);

    console.log(`[Payment][COMBINED] AWAITING_GATEWAY | paymentId=${payment.id}`);

    return {
      payment,
      redirectUrl: gatewayRequest.redirectUrl,
    };
  }

  private async handleGatewayPayment(
    manager: EntityManager,
    payment: Payment,
    invoice: Invoice,
    gatewayAmount: bigint,
  ) {
    console.log(`[Payment][GATEWAY] START | paymentId=${payment.id} | amount=${gatewayAmount}`);

    const gatewayRequest = await this.paymentGateway.createPaymentRequest({
      idempotencyKey: `gateway-${payment.id}`,

      amount: Number(gatewayAmount),

      callback: `${this.callbackBase()}/payments/gateway/callback/${payment.id}`,
    });

    console.log(
      `[Payment][GATEWAY] CREATE SUCCESS | paymentId=${payment.id} | authority=${gatewayRequest.authority}`,
    );

    payment.gatewayTransactionId = gatewayRequest.authority;

    payment.gatewayRedirectUrl = gatewayRequest.redirectUrl;

    payment.status = PaymentStatus.AWAITING_GATEWAY;

    await manager.save(payment);

    console.log(`[Payment][GATEWAY] AWAITING_GATEWAY | paymentId=${payment.id}`);

    return {
      payment,
      redirectUrl: gatewayRequest.redirectUrl,
    };
  }

  private validatePaymentMethod(
    selectedMethod: PaymentMethod,
    walletAmount: bigint,
    gatewayAmount: bigint,
  ) {
    console.log(
      `[Payment] validatePaymentMethod | method=${selectedMethod} | walletAmount=${walletAmount} | gatewayAmount=${gatewayAmount}`,
    );

    switch (selectedMethod) {
      case PaymentMethod.WALLET:
        if (gatewayAmount > 0n) {
          console.log(`[Payment] WALLET validation failed | insufficient balance`);

          throw new BadRequestException('Wallet balance is insufficient for wallet payment');
        }

        break;

      case PaymentMethod.GATEWAY:
        break;

      case PaymentMethod.COMBINED:
        if (walletAmount === 0n) {
          console.log(`[Payment] COMBINED validation failed | walletAmount=0`);

          throw new BadRequestException('Combined payment is not available');
        }

        if (gatewayAmount === 0n) {
          console.log(`[Payment] COMBINED validation failed | gatewayAmount=0`);

          throw new BadRequestException('Combined payment is not required');
        }

        break;

      default:
        console.log(`[Payment] Invalid payment method | method=${selectedMethod}`);

        throw new BadRequestException('Invalid payment method');
    }

    console.log(`[Payment] Payment method validation SUCCESS`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private callbackBase(): string {
    return this.configService.getOrThrow<string>('APP_BASE_URL');
  }

  async handleGatewayCallback(paymentId: string, token: string, status: string) {
    console.log(`[Payment][GATEWAY] CALLBACK START | paymentId=${paymentId} | status=${status}`);

    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        console.log(`[Payment][GATEWAY] ERROR payment not found | paymentId=${paymentId}`);
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.FAILED) {
        console.log(
          `[Payment][GATEWAY] Already finalized | paymentId=${paymentId} | status=${payment.status}`,
        );
        return { payment };
      }

      if (payment.status !== PaymentStatus.AWAITING_GATEWAY) {
        console.log(
          `[Payment][GATEWAY] ERROR unexpected status | paymentId=${paymentId} | status=${payment.status}`,
        );
        throw new BadRequestException(
          `Payment is not awaiting gateway confirmation (status=${payment.status})`,
        );
      }

      const invoice = await manager.findOne(Invoice, {
        where: { id: payment.invoiceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (status === 'success') {
        const verified = await this.paymentGateway.verifyPayment({
          authority: payment.gatewayTransactionId!,
          amount: Number(payment.gatewayAmount),
          token,
        });

        if (!verified.success) {
          console.log(`[Payment][GATEWAY] Verification FAILED | paymentId=${paymentId}`);
          payment.status = PaymentStatus.FAILED;
          await manager.save(payment);
          return { payment };
        }

        console.log(`[Payment][GATEWAY] Verification SUCCESS | paymentId=${paymentId}`);
        payment.status = PaymentStatus.SUCCESS;
        invoice.status = InvoiceStatus.PAID;
      } else {
        console.log(`[Payment][GATEWAY] status=${status} → FAILED | paymentId=${paymentId}`);
        payment.status = PaymentStatus.FAILED;
      }

      await manager.save(payment);
      await manager.save(invoice);

      console.log(
        `[Payment][GATEWAY] CALLBACK END | paymentId=${paymentId} | paymentStatus=${payment.status} | invoiceStatus=${invoice.status}`,
      );

      return { payment };
    });
  }

  async refund(paymentId: string) {
    console.log(`[Payment][REFUND] START | paymentId=${paymentId}`);

    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        console.log(`[Payment][REFUND] ERROR payment not found | paymentId=${paymentId}`);
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.REFUNDED) {
        console.log(`[Payment][REFUND] Already refunded | paymentId=${paymentId}`);
        return { payment };
      }

      if (payment.status !== PaymentStatus.SUCCESS) {
        console.log(
          `[Payment][REFUND] ERROR not refundable | paymentId=${paymentId} | status=${payment.status}`,
        );
        throw new BadRequestException(
          `Only SUCCESS payments can be refunded (current status=${payment.status})`,
        );
      }

      const invoice = await manager.findOne(Invoice, {
        where: { id: payment.invoiceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (BigInt(payment.walletAmount) > 0n) {
        console.log(`[Payment][REFUND][PALIZ] CREATE (reverse) START | paymentId=${paymentId}`);

        await this.palizPaymentService.createTransfer({
          paymentId: payment.id,
          amount: Number(payment.walletAmount),
          callback: `${this.callbackBase()}/payments/paliz/refund-callback/${payment.id}`,
          reference: invoice.id,
          reverse: true,
        });

        console.log(`[Payment][REFUND][PALIZ] CREATE SUCCESS | paymentId=${paymentId} `);

        console.log(`[Payment][REFUND][PALIZ] Waiting 1500ms before INFO | paymentId=${paymentId}`);
        await this.sleep(1500);

        console.log(`[Payment][REFUND][PALIZ] INFO START | paymentId=${paymentId}`);

        const info = await this.palizPaymentService.getTransferInfo({ paymentId: payment.id });

        console.log(
          `[Payment][REFUND][PALIZ] INFO RESPONSE | paymentId=${paymentId} | status=${info?.data?.status}`,
        );

        if (info?.data?.status === 'firstcommit') {
          console.log(
            `[Payment][REFUND][PALIZ] STATUS=firstcommit → COMMIT | paymentId=${paymentId}`,
          );

          await this.palizPaymentService.commitTransfer({
            paymentId: payment.id,
            transactionPhrase: info.data.transaction_phrase,
          });

          console.log(`[Payment][REFUND][PALIZ] COMMIT SUCCESS | paymentId=${paymentId}`);

          const wallet = await manager.findOne(Wallet, {
            where: { userId: invoice.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          const newBalance = BigInt(wallet.balance) + BigInt(payment.walletAmount);
          wallet.balance = newBalance.toString();
          await manager.save(wallet);

          console.log(
            `[Payment][REFUND][WALLET] Wallet credited | paymentId=${paymentId} | amount=${payment.walletAmount} | newBalance=${newBalance}`,
          );
        } else {
          console.log(
            `[Payment][REFUND][PALIZ] STATUS=${info?.data?.status} → CANCEL | paymentId=${paymentId}`,
          );

          await this.palizPaymentService.cancelTransfer({
            paymentId: payment.id,
            transactionPhrase: info?.data?.transaction_phrase,
          });

          console.log(`[Payment][REFUND][PALIZ] CANCEL SUCCESS | paymentId=${paymentId}`);

          throw new BadRequestException(
            `Paliz refund transfer failed for payment ${paymentId} (status=${info?.data?.status})`,
          );
        }
      }

      if (BigInt(payment.gatewayAmount) > 0n) {
        console.log(`[Payment][REFUND][GATEWAY] Reversing gateway leg | paymentId=${paymentId}`);

        await this.paymentGateway.refundPayment({
          transactionId: payment.gatewayTransactionId!,
          amount: Number(payment.gatewayAmount),
        });

        console.log(`[Payment][REFUND][GATEWAY] Gateway refund requested | paymentId=${paymentId}`);
      }

      payment.status = PaymentStatus.REFUNDED;
      invoice.status = InvoiceStatus.REFUNDED;

      await manager.save(payment);
      await manager.save(invoice);

      console.log(
        `[Payment][REFUND] END | paymentId=${paymentId} | paymentStatus=${payment.status} | invoiceStatus=${invoice.status}`,
      );

      return { payment };
    });
  }
}
