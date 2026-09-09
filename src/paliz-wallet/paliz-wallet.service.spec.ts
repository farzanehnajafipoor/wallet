import { describe, expect, it, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { PalizWalletService, PalizRequestFailedException } from './paliz-wallet.service.js';

describe('PalizWalletService', () => {
  let service: PalizWalletService;

  const httpService = {
    post: vi.fn(),
  };

  const configService = {
    getOrThrow: vi.fn((key: string) => {
      const config: Record<string, string> = {
        PALIZ_WALLET_BASE_URL: 'https://paliz.test',
        PALIZ_WALLET_SERVICE_ID: 'wallet-service',
        PALIZ_WALLET_CURRENCY: 'IRR',
        PALIZ_WALLET_SERVICE_ADDRESS: 'service-address',
        PALIZ_WALLET_USER_ADDRESS: 'user-address',
        PALIZ_WALLET_USERNAME: 'username',
        PALIZ_WALLET_PASSWORD: 'password',
      };

      return config[key];
    }),
  };

  const encryptionService = {
    encrypt: vi.fn((payload: unknown) => ({
      encrypted: true,
      payload,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new PalizWalletService(
      httpService as any,
      configService as any,
      encryptionService as any,
    );
  });

  describe('createTransfer', () => {
    it('should create and send a normal transfer', async () => {
      const response = {
        tracking_id: 'tracking-123',
      };

      httpService.post.mockReturnValue(of({ data: response }));

      const result = await service.createTransfer({
        unique_id: 'unique-123',
        sequence_id: 1,
        amount: 100000,
        callback: 'https://example.com/callback',
        reference: 'payment-123',
      });

      expect(result).toEqual(response);

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          unique_id: 'unique-123',
          sequence_id: 1,
          action: 'create',
          data: {
            from: 'user-address',
            to: 'service-address',
            amount: 100000,
            currency: 'IRR',
            callback: 'https://example.com/callback',
            reference: 'payment-123',
          },
          time: expect.any(String),
        }),
      );

      expect(httpService.post).toHaveBeenCalledWith(
        'https://paliz.test/action',
        expect.objectContaining({
          payload: expect.anything(),
          serviceId: 'wallet-service',
        }),
        {
          auth: {
            username: 'username',
            password: 'password',
          },
        },
      );
    });

    it('should reverse the from/to addresses when reverse is true', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            tracking_id: 'refund-tracking-123',
          },
        }),
      );

      await service.createTransfer({
        unique_id: 'refund-123',
        sequence_id: 2,
        amount: 50000,
        reverse: true,
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          data: expect.objectContaining({
            from: 'service-address',
            to: 'user-address',
            amount: 50000,
            currency: 'IRR',
          }),
        }),
      );
    });
  });

  describe('commitTransfer', () => {
    it('should send a commit transfer request', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            success: true,
          },
        }),
      );

      const result = await service.commitTransfer({
        unique_id: 'commit-123',
        sequence_id: 2,
        transaction_phrase: 'phrase-123',
        create_unique_id: 'create-123',
        create_sequence_id: 1,
      });

      expect(result).toEqual({
        success: true,
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          unique_id: 'commit-123',
          sequence_id: 2,
          action: 'commit',
          data: {
            transaction_phrase: 'phrase-123',
            unique_id: 'create-123',
            sequence_id: 1,
          },
          time: expect.any(String),
        }),
      );

      expect(httpService.post).toHaveBeenCalledWith(
        'https://paliz.test/action',
        expect.objectContaining({
          payload: expect.anything(),
          serviceId: 'wallet-service',
        }),
        expect.any(Object),
      );
    });
  });

  describe('cancelTransfer', () => {
    it('should send a cancel transfer request', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            success: true,
          },
        }),
      );

      const result = await service.cancelTransfer({
        unique_id: 'cancel-123',
        sequence_id: 3,
        transaction_phrase: 'phrase-123',
        create_unique_id: 'create-123',
        create_sequence_id: 1,
      });

      expect(result).toEqual({
        success: true,
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          unique_id: 'cancel-123',
          sequence_id: 3,
          action: 'cancel',
          data: {
            transaction_phrase: 'phrase-123',
            unique_id: 'create-123',
            sequence_id: 1,
          },
          time: expect.any(String),
        }),
      );
    });
  });

  describe('getTransferInfo', () => {
    it('should send the tracking id', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            tracking_id: 'tracking-123',
            status: 'delivered',
          },
        }),
      );

      const result = await service.getTransferInfo({
        tracking_id: 'tracking-123',
      });

      expect(result).toEqual({
        tracking_id: 'tracking-123',
        status: 'delivered',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://paliz.test/info',
        {
          action: 'info',
          time: expect.any(String),
          tracking_id: 'tracking-123',
        },
        {
          auth: {
            username: 'username',
            password: 'password',
          },
        },
      );
    });
  });

  describe('getBalance', () => {
    it('should request the balance for an address', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            balance: 1000000,
          },
        }),
      );

      const result = await service.getBalance({
        address: 'user-address',
      });

      expect(result).toEqual({
        balance: 1000000,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://paliz.test/balance',
        {
          address: 'user-address',
          currency: 'IRR',
        },
        {
          auth: {
            username: 'username',
            password: 'password',
          },
        },
      );
    });
  });

  describe('error handling', () => {
    it('should throw rejected when Paliz returns an HTTP error response', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: 'Invalid transfer',
          },
        },
        message: 'Request failed with status code 400',
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.getBalance({
          address: 'user-address',
        }),
      ).rejects.toMatchObject({
        name: 'PalizRequestFailedException',
        deliveryStatus: 'rejected',
        message: 'Paliz balance call failed with status 400',
        cause: {
          error: 'Invalid transfer',
        },
      });
    });

    it('should throw unknown when request was sent but no response was received', async () => {
      const axiosError = {
        request: {},
        message: 'timeout of 5000ms exceeded',
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.getBalance({
          address: 'user-address',
        }),
      ).rejects.toMatchObject({
        name: 'PalizRequestFailedException',
        deliveryStatus: 'unknown',
        message: 'Paliz balance call timed out or connection was lost — delivery unknown',
      });
    });

    it('should throw not_delivered when request failed before being sent', async () => {
      const axiosError = {
        message: 'Network configuration error',
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.getBalance({
          address: 'user-address',
        }),
      ).rejects.toMatchObject({
        name: 'PalizRequestFailedException',
        deliveryStatus: 'not_delivered',
        message: 'Paliz balance call failed before it was sent',
      });
    });
  });

  describe('getWalletConfig', () => {
    it('should return wallet configuration', () => {
      expect(service.getWalletConfig()).toEqual({
        baseUrl: 'https://paliz.test',
        serviceId: 'wallet-service',
        currency: 'IRR',
        serviceAddress: 'service-address',
        userAddress: 'user-address',
      });
    });
  });

  describe('PalizRequestFailedException', () => {
    it('should preserve delivery status and cause', () => {
      const cause = new Error('connection failed');

      const error = new PalizRequestFailedException('Request failed', 'unknown', cause);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PalizRequestFailedException');
      expect(error.message).toBe('Request failed');
      expect(error.deliveryStatus).toBe('unknown');
      expect(error.cause).toBe(cause);
    });
  });
});
