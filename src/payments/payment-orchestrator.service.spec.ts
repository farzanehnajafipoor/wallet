import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mocked, Mock } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { PaymentOrchestratorService } from './payment-orchestrator.service.js';
import { PalizPaymentService } from './paliz-payment.service.js';
import { PalizWalletService } from '../paliz-wallet/paliz-wallet.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { ConfigService } from '@nestjs/config';
import type { PaymentGateway } from '../payment-gateway/payment-gateway.interface.js';

import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity.js';
import { Wallet } from '../wallets/entities/wallet.entity.js';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity.js';

interface MockManager {
  findOne: Mock;
  create: Mock;
  save: Mock;
}

interface MockDataSource {
  manager: { findOne: Mock };
  transaction: Mock;
}

interface MockConfigService {
  getOrThrow: Mock;
}

describe('PaymentOrchestratorService', () => {
  let service: PaymentOrchestratorService;

  let dataSource: MockDataSource;
  let manager: MockManager;
  let palizPaymentService: Mocked<
    Pick<
      PalizPaymentService,
      'createTransfer' | 'getTransferInfo' | 'commitTransfer' | 'cancelTransfer'
    >
  >;
  let palizWalletService: Mocked<Partial<PalizWalletService>>;
  let paymentGateway: Mocked<PaymentGateway>;
  let configService: MockConfigService;
  let walletsService: Mocked<Pick<WalletsService, 'refreshWalletBalance'>>;

  const invoiceId = 'invoice-1';
  const userId = 'user-1';
  const paymentId = 'payment-1';

  const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice =>
    ({
      id: invoiceId,
      userId,
      amount: '50000',
      status: InvoiceStatus.UNPAID,
      ...overrides,
    }) as Invoice;

  const makeWallet = (overrides: Partial<Wallet> = {}): Wallet =>
    ({
      id: 'wallet-1',
      userId,
      balance: 100000,
      ...overrides,
    }) as Wallet;

  const makePayment = (overrides: Partial<Payment> = {}): Payment =>
    ({
      id: paymentId,
      invoiceId,
      method: PaymentMethod.WALLET,
      amount: '50000',
      walletAmount: '50000',
      gatewayAmount: '0',
      status: PaymentStatus.INITIATED,
      gatewayTransactionId: null,
      gatewayRedirectUrl: null,
      palizUniqueId: null,
      palizTrackingId: null,
      palizLastSequenceId: 0,
      palizTransactionPhrase: null,
      ...overrides,
    }) as Payment;

  beforeEach(() => {
    manager = {
      findOne: vi.fn(),
      create: vi.fn((_entity, data) => ({ id: paymentId, ...data }) as any),
      save: vi.fn(async (entity) => entity),
    };

    dataSource = {
      manager: { findOne: vi.fn() } as any,
      transaction: vi.fn(async (cb: (m: EntityManager) => Promise<any>) =>
        cb(manager as unknown as EntityManager),
      ),
    };

    palizPaymentService = {
      createTransfer: vi.fn(),
      getTransferInfo: vi.fn(),
      commitTransfer: vi.fn(),
      cancelTransfer: vi.fn(),
    };

    palizWalletService = {
      getWalletConfig: vi.fn().mockReturnValue({
        baseUrl: 'https://paliz.example.com',
        serviceId: 'svc-1',
        currency: 'IRR',
        from: 'user-address',
        to: 'service-address',
      }),
    };

    paymentGateway = {
      createPaymentRequest: vi.fn(),
      verifyPayment: vi.fn(),
      refundPayment: vi.fn(),
    } as unknown as Mocked<PaymentGateway>;

    configService = {
      getOrThrow: vi.fn().mockReturnValue('https://app.example.com'),
    };

    walletsService = {
      refreshWalletBalance: vi.fn(),
    };

    service = new PaymentOrchestratorService(
      dataSource as unknown as DataSource,
      palizPaymentService as unknown as PalizPaymentService,
      palizWalletService as unknown as PalizWalletService,
      paymentGateway,
      configService as unknown as ConfigService,
      walletsService as unknown as WalletsService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('pay()', () => {
    it('throws NotFoundException if invoice does not exist', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.pay(invoiceId, PaymentMethod.WALLET)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if invoice is not UNPAID', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ status: InvoiceStatus.PAID }));

      await expect(service.pay(invoiceId, PaymentMethod.WALLET)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if locked invoice disappears inside the transaction', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice());
      walletsService.refreshWalletBalance.mockResolvedValueOnce(100000);
      manager.findOne.mockResolvedValueOnce(null); // locked invoice lookup fails

      await expect(service.pay(invoiceId, PaymentMethod.WALLET)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if wallet does not exist', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice());
      walletsService.refreshWalletBalance.mockResolvedValueOnce(100000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice()) // locked invoice
        .mockResolvedValueOnce(null); // wallet

      await expect(service.pay(invoiceId, PaymentMethod.WALLET)).rejects.toThrow(NotFoundException);
    });

    it('[KNOWN GAP] currently does NOT reject WALLET payment when balance is insufficient', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ amount: 999999999 }));
      walletsService.refreshWalletBalance.mockResolvedValueOnce(100000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice({ amount: 999999999 }))
        .mockResolvedValueOnce(makeWallet({ balance: '100000' }))
        .mockResolvedValueOnce(null);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'rejected' },
      });
      palizPaymentService.cancelTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      // Documents the gap: no BadRequestException, wallet reserved negative.
      expect(result.payment.status).toBe(PaymentStatus.FAILED);
    });

    it('returns early if an existing payment is already SUCCESS', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice());
      walletsService.refreshWalletBalance.mockResolvedValueOnce(100000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice())
        .mockResolvedValueOnce(makeWallet())
        .mockResolvedValueOnce(makePayment({ status: PaymentStatus.SUCCESS }));

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      expect(result.redirectUrl).toBeNull();
      expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(palizPaymentService.createTransfer).not.toHaveBeenCalled();
    });

    it('returns early if an existing payment is AWAITING_GATEWAY, with its redirect URL', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice());
      walletsService.refreshWalletBalance.mockResolvedValueOnce(100000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice())
        .mockResolvedValueOnce(makeWallet())
        .mockResolvedValueOnce(
          makePayment({
            status: PaymentStatus.AWAITING_GATEWAY,
            gatewayRedirectUrl: 'https://gateway.example.com/redirect',
          }),
        );

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      expect(result.redirectUrl).toBe('https://gateway.example.com/redirect');
    });
  });

  describe('pay() — WALLET flow', () => {
    const setupWalletFlow = (walletBalance = 100000, invoiceAmount = 50000) => {
      const wallet = makeWallet({ balance: walletBalance.toString() });

      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ amount: invoiceAmount }));
      walletsService.refreshWalletBalance.mockResolvedValueOnce(walletBalance);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice({ amount: invoiceAmount }))
        .mockResolvedValueOnce(wallet)
        .mockResolvedValueOnce(null);

      return { wallet };
    };

    it('completes successfully when Paliz returns firstcommit', async () => {
      setupWalletFlow();

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
        data: { tracking_id: 'track-1' },
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'firstcommit', transaction_phrase: 'phrase-1' },
      });
      palizPaymentService.commitTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      expect(palizPaymentService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000, reverse: false }),
      );
      expect(palizPaymentService.commitTransfer).toHaveBeenCalledWith({
        paymentId,
        transactionPhrase: 'phrase-1',
      });
      expect(palizPaymentService.cancelTransfer).not.toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(result.redirectUrl).toBeNull();
    });

    it('reserves the wallet balance before calling Paliz', async () => {
      const { wallet } = setupWalletFlow(100000, 50000);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'firstcommit', transaction_phrase: 'phrase-1' },
      });
      palizPaymentService.commitTransfer.mockResolvedValueOnce({ ok: true });

      await service.pay(invoiceId, PaymentMethod.WALLET);

      // Orchestrator always does wallet.balance = newBalance.toString() —
      // the stored value is a string regardless of the fixture's input type.
      expect(wallet.balance).toBe('50000');
    });

    it('cancels and restores wallet balance when Paliz does not return firstcommit', async () => {
      const { wallet } = setupWalletFlow(100000, 50000);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'rejected' },
      });
      palizPaymentService.cancelTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      expect(palizPaymentService.cancelTransfer).toHaveBeenCalledWith({
        paymentId,
        transactionPhrase: undefined,
      });
      expect(palizPaymentService.commitTransfer).not.toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.FAILED);
      expect(wallet.balance).toBe('100000');
    });

    it('does not mutate invoice status to PAID on failure', async () => {
      setupWalletFlow();

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({ data: { status: 'canceled' } });
      palizPaymentService.cancelTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.pay(invoiceId, PaymentMethod.WALLET);

      expect(result.payment.status).toBe(PaymentStatus.FAILED);
      const invoiceArg = manager.save.mock.calls.find(
        ([entity]) => (entity as any).id === invoiceId,
      )?.[0] as Invoice | undefined;
      expect(invoiceArg?.status).not.toBe(InvoiceStatus.PAID);
    });
  });

  describe('pay() — GATEWAY flow', () => {
    it('creates a gateway payment request and returns AWAITING_GATEWAY', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice());
      walletsService.refreshWalletBalance.mockResolvedValueOnce(0);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice())
        .mockResolvedValueOnce(makeWallet({ balance: '0' }))
        .mockResolvedValueOnce(null);

      paymentGateway.createPaymentRequest.mockResolvedValueOnce({
        authority: 'auth-1',
        redirectUrl: 'https://gateway.example.com/pay/auth-1',
      } as any);

      const result = await service.pay(invoiceId, PaymentMethod.GATEWAY);

      expect(paymentGateway.createPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000 }),
      );
      expect(result.payment.status).toBe(PaymentStatus.AWAITING_GATEWAY);
      expect(result.redirectUrl).toBe('https://gateway.example.com/pay/auth-1');
      expect(palizPaymentService.createTransfer).not.toHaveBeenCalled();
    });
  });

  describe('pay() — COMBINED flow', () => {
    it('splits between wallet and gateway, ending AWAITING_GATEWAY', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ amount: 80000 }));
      walletsService.refreshWalletBalance.mockResolvedValueOnce(30000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice({ amount: 80000 }))
        .mockResolvedValueOnce(makeWallet({ balance: '30000' }))
        .mockResolvedValueOnce(null);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-1',
        sequenceId: '1',
      });

      paymentGateway.createPaymentRequest.mockResolvedValueOnce({
        authority: 'auth-2',
        redirectUrl: 'https://gateway.example.com/pay/auth-2',
      } as any);

      const result = await service.pay(invoiceId, PaymentMethod.COMBINED);

      expect(palizPaymentService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 30000, reverse: false }),
      );
      expect(paymentGateway.createPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000 }),
      );
      expect(result.payment.status).toBe(PaymentStatus.AWAITING_GATEWAY);
      expect(result.redirectUrl).toBe('https://gateway.example.com/pay/auth-2');
    });

    it('rejects COMBINED when wallet alone can cover the full invoice', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ amount: 10000 }));
      walletsService.refreshWalletBalance.mockResolvedValueOnce(50000);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice({ amount: 10000 }))
        .mockResolvedValueOnce(makeWallet({ balance: '50000' }));

      await expect(service.pay(invoiceId, PaymentMethod.COMBINED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects COMBINED when wallet balance is zero', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(makeInvoice({ amount: 10000 }));
      walletsService.refreshWalletBalance.mockResolvedValueOnce(0);
      manager.findOne
        .mockResolvedValueOnce(makeInvoice({ amount: 10000 }))
        .mockResolvedValueOnce(makeWallet({ balance: '0' }));

      await expect(service.pay(invoiceId, PaymentMethod.COMBINED)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleGatewayCallback()', () => {
    it('throws NotFoundException if payment does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(service.handleGatewayCallback(paymentId, 'token-1', 'success')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns early without re-verifying if payment is already finalized', async () => {
      manager.findOne.mockResolvedValueOnce(makePayment({ status: PaymentStatus.SUCCESS }));

      const result = await service.handleGatewayCallback(paymentId, 'token-1', 'success');

      expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(paymentGateway.verifyPayment).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if payment is not AWAITING_GATEWAY', async () => {
      manager.findOne.mockResolvedValueOnce(makePayment({ status: PaymentStatus.INITIATED }));

      await expect(service.handleGatewayCallback(paymentId, 'token-1', 'success')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('marks SUCCESS and PAID when status=success and gateway verifies', async () => {
      manager.findOne
        .mockResolvedValueOnce(
          makePayment({
            status: PaymentStatus.AWAITING_GATEWAY,
            gatewayTransactionId: 'auth-1',
            gatewayAmount: '50000',
          }),
        )
        .mockResolvedValueOnce(makeInvoice());

      paymentGateway.verifyPayment.mockResolvedValueOnce({ success: true } as any);

      const result = await service.handleGatewayCallback(paymentId, 'token-1', 'success');

      expect(paymentGateway.verifyPayment).toHaveBeenCalledWith({
        authority: 'auth-1',
        amount: 50000,
        token: 'token-1',
      });
      expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    });

    it('marks FAILED when status=success but gateway verification fails', async () => {
      manager.findOne
        .mockResolvedValueOnce(
          makePayment({ status: PaymentStatus.AWAITING_GATEWAY, gatewayTransactionId: 'auth-1' }),
        )
        .mockResolvedValueOnce(makeInvoice());

      paymentGateway.verifyPayment.mockResolvedValueOnce({ success: false } as any);

      const result = await service.handleGatewayCallback(paymentId, 'token-1', 'success');

      expect(result.payment.status).toBe(PaymentStatus.FAILED);
    });

    it('marks FAILED directly when status=failed, without calling verifyPayment', async () => {
      manager.findOne
        .mockResolvedValueOnce(
          makePayment({ status: PaymentStatus.AWAITING_GATEWAY, gatewayTransactionId: 'auth-1' }),
        )
        .mockResolvedValueOnce(makeInvoice());

      const result = await service.handleGatewayCallback(paymentId, 'token-1', 'failed');

      expect(paymentGateway.verifyPayment).not.toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('refund()', () => {
    it('throws NotFoundException if payment does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(service.refund(paymentId)).rejects.toThrow(NotFoundException);
    });

    it('returns early if payment is already REFUNDED', async () => {
      manager.findOne.mockResolvedValueOnce(makePayment({ status: PaymentStatus.REFUNDED }));

      const result = await service.refund(paymentId);

      expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
      expect(palizPaymentService.createTransfer).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if payment is not SUCCESS', async () => {
      manager.findOne.mockResolvedValueOnce(makePayment({ status: PaymentStatus.FAILED }));

      await expect(service.refund(paymentId)).rejects.toThrow(BadRequestException);
    });

    it('refunds the wallet leg via a reverse Paliz transfer and credits the wallet on firstcommit', async () => {
      const wallet = makeWallet({ balance: '50000' });

      manager.findOne
        .mockResolvedValueOnce(
          makePayment({
            status: PaymentStatus.SUCCESS,
            walletAmount: '50000',
            gatewayAmount: '0',
          }),
        )
        .mockResolvedValueOnce(makeInvoice({ status: InvoiceStatus.PAID }))
        .mockResolvedValueOnce(wallet);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-refund-1',
        sequenceId: '2',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'firstcommit', transaction_phrase: 'phrase-refund' },
      });
      palizPaymentService.commitTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.refund(paymentId);

      expect(palizPaymentService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000, reverse: true }),
      );
      expect(palizPaymentService.commitTransfer).toHaveBeenCalledWith({
        paymentId,
        transactionPhrase: 'phrase-refund',
      });

      // Same fix as the pay()-flow tests: assert on the exact wallet
      // instance directly (50000 + 50000 credited back = '100000'),
      // rather than searching manager.save.mock.calls for a shape match.
      expect(wallet.balance).toBe('100000');

      expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    });

    it('aborts the refund (throws) if the reverse Paliz transfer does not reach firstcommit', async () => {
      manager.findOne
        .mockResolvedValueOnce(
          makePayment({ status: PaymentStatus.SUCCESS, walletAmount: '50000', gatewayAmount: '0' }),
        )
        .mockResolvedValueOnce(makeInvoice({ status: InvoiceStatus.PAID }));

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-refund-2',
        sequenceId: '3',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'rejected' },
      });
      palizPaymentService.cancelTransfer.mockResolvedValueOnce({ ok: true });

      await expect(service.refund(paymentId)).rejects.toThrow(BadRequestException);

      const refundedSave = manager.save.mock.calls.find(
        ([entity]) => (entity as any).status === PaymentStatus.REFUNDED,
      );
      expect(refundedSave).toBeFalsy();
    });

    it('refunds the gateway leg directly when there is no wallet amount', async () => {
      manager.findOne
        .mockResolvedValueOnce(
          makePayment({
            status: PaymentStatus.SUCCESS,
            walletAmount: '0',
            gatewayAmount: '50000',
            gatewayTransactionId: 'auth-3',
          }),
        )
        .mockResolvedValueOnce(makeInvoice({ status: InvoiceStatus.PAID }));

      const result = await service.refund(paymentId);

      expect(palizPaymentService.createTransfer).not.toHaveBeenCalled();
      expect(paymentGateway.refundPayment).toHaveBeenCalledWith({
        transactionId: 'auth-3',
        amount: 50000,
      });
      expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    });

    it('refunds both legs for a COMBINED payment', async () => {
      const wallet = makeWallet({ balance: '0' });

      manager.findOne
        .mockResolvedValueOnce(
          makePayment({
            status: PaymentStatus.SUCCESS,
            walletAmount: '30000',
            gatewayAmount: '50000',
            gatewayTransactionId: 'auth-4',
          }),
        )
        .mockResolvedValueOnce(makeInvoice({ status: InvoiceStatus.PAID }))
        .mockResolvedValueOnce(wallet);

      palizPaymentService.createTransfer.mockResolvedValueOnce({
        uniqueId: 'u-refund-3',
        sequenceId: '4',
      });
      palizPaymentService.getTransferInfo.mockResolvedValueOnce({
        data: { status: 'firstcommit', transaction_phrase: 'phrase-combined' },
      });
      palizPaymentService.commitTransfer.mockResolvedValueOnce({ ok: true });

      const result = await service.refund(paymentId);

      expect(palizPaymentService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 30000, reverse: true }),
      );
      expect(paymentGateway.refundPayment).toHaveBeenCalledWith({
        transactionId: 'auth-4',
        amount: 50000,
      });
      expect(wallet.balance).toBe('30000');
      expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
