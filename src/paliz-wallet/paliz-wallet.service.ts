import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { PalizEncryptionService } from './paliz-encryption.service.js';

export class PalizRequestFailedException extends Error {
  constructor(
    message: string,
    public readonly deliveryStatus: 'not_delivered' | 'unknown' | 'rejected',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PalizRequestFailedException';
  }
}

@Injectable()
export class PalizWalletService {
  private readonly logger = new Logger(PalizWalletService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryptionService: PalizEncryptionService,
  ) {}

  async createTransfer(data: {
    unique_id: string;
    sequence_id: number;
    amount: number;
    callback?: string;
    reference?: string;
  }) {
    const { serviceAddress, userAddress, currency, serviceId } = this.getWalletConfig();

    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'create',
      data: {
        from: userAddress,
        to: serviceAddress,
        amount: data.amount,
        currency,
        callback: data.callback,
        reference: data.reference,
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    return this.post('action', {
      payload: encryptedPayload,
      serviceId,
    });
  }

  async commitTransfer(data: {
    unique_id: string;
    sequence_id: number;
    transaction_phrase: string;
    create_unique_id: string;
    create_sequence_id: number;
  }) {
    const { serviceId } = this.getWalletConfig();

    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'commit',
      data: {
        transaction_phrase: data.transaction_phrase,
        unique_id: data.create_unique_id,
        sequence_id: data.create_sequence_id,
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    return this.post('action', {
      payload: encryptedPayload,
      serviceId,
    });
  }

  async cancelTransfer(data: {
    unique_id: string;
    sequence_id: number;
    transaction_phrase: string;
    create_unique_id: string;
    create_sequence_id: number;
  }) {
    const { serviceId } = this.getWalletConfig();

    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'cancel',
      data: {
        transaction_phrase: data.transaction_phrase,
        unique_id: data.create_unique_id,
        sequence_id: data.create_sequence_id,
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    return this.post('action', {
      payload: encryptedPayload,
      serviceId,
    });
  }

  async getTransferInfo(data: {
    tracking_id: string;
  }) {
    const payload: Record<string, unknown> = {
      action: 'info',
      time: new Date().toISOString(),
    };
    
    payload.tracking_id = data.tracking_id;
    return this.post('info', payload);
  }

  async getBalance(data: { address: string }) {
    const { currency } = this.getWalletConfig();

    const payload: Record<string, unknown> = {
      address: data.address,
      currency,
    };

    return this.post('balance', payload);
  }

  private async post(action: string, payload: unknown) {
    const { baseUrl } = this.getWalletConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/${action}`, payload, this.getAuthConfig()),
      );
      console.log('response', response.data)
      return response.data;
      
    } catch (err) {
      const axiosErr = err as AxiosError;

      if (axiosErr.response) {
        this.logger.error(
          `Paliz ${action} rejected: ${axiosErr.response.status}`,
          axiosErr.response.data,
        );
        throw new PalizRequestFailedException(
          `Paliz ${action} call failed with status ${axiosErr.response.status}`,
          'rejected',
          axiosErr.response.data,
        );
      }

      if (axiosErr.request) {
        this.logger.error(`Paliz ${action} call: no response received`, axiosErr.message);
        throw new PalizRequestFailedException(
          `Paliz ${action} call timed out or connection was lost — delivery unknown`,
          'unknown',
          axiosErr,
        );
      }

      this.logger.error(`Paliz ${action} call failed before sending`, axiosErr.message);
      throw new PalizRequestFailedException(
        `Paliz ${action} call failed before it was sent`,
        'not_delivered',
        axiosErr,
      );
    }
  }

  private getAuthConfig(): AxiosRequestConfig {
    const username = this.configService.getOrThrow<string>('PALIZ_WALLET_USERNAME');
    const password = this.configService.getOrThrow<string>('PALIZ_WALLET_PASSWORD');

    return {
      auth: { username, password },
    };
  }

  getWalletConfig() {
    return {
      baseUrl: this.configService.getOrThrow<string>('PALIZ_WALLET_BASE_URL'),
      serviceId: this.configService.getOrThrow<string>('PALIZ_WALLET_SERVICE_ID'),
      currency: this.configService.getOrThrow<string>('PALIZ_WALLET_CURRENCY'),
      serviceAddress: this.configService.getOrThrow<string>('PALIZ_WALLET_SERVICE_ADDRESS'),
      userAddress: this.configService.getOrThrow<string>('PALIZ_WALLET_USER_ADDRESS'),
    };
  }
}