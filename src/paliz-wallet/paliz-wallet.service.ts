import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PalizEncryptionService } from './paliz-encryption.service.js';

@Injectable()
export class PalizWalletService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryptionService: PalizEncryptionService,
  ) {}

  async createTransfer(data: {
    unique_id: string;
    sequence_id: number;
    amount: number;
    callback: string;
    reference?: string;
  }) {
    const from = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_FROM_ADDRESS',
    );

    const to = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_TO_ADDRESS',
    );

    const currency = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_CURRENCY',
    );

    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'create',
      data: {
        from,
        to,
        amount: data.amount,
        currency,
        callback: data.callback,
        reference: data.reference,
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    const baseUrl = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_BASE_URL',
    );

    const serviceId = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_SERVICE_ID',
    );

    const response = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}/action`,
        {
          payload: encryptedPayload,
          serviceId,
        },
        this.getAuthConfig(),
      ),
    );

    return response.data;
  }

  async commitTransfer(data: {
    unique_id: string;
    sequence_id: number;
    transaction_phrase: string;
  }) {
    
    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'commit',
      data: {
        transaction_phrase : data.transaction_phrase,
        unique_id : data.unique_id,
        sequence_id : data.sequence_id
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    const baseUrl = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_BASE_URL',
    );

    const serviceId = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_SERVICE_ID',
    );

    const response = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}/action`,
        {
          payload: encryptedPayload,
          serviceId,
        },
        this.getAuthConfig(),
      ),
    );

    return response.data;
  }

  async cancelTransfer(data: {
    unique_id: string;
    sequence_id: number;
    transaction_phrase: string;
  }) {
    
    const payload = {
      unique_id: data.unique_id,
      sequence_id: data.sequence_id,
      action: 'cancel',
      data: {
        transaction_phrase : data.transaction_phrase,
        unique_id : data.unique_id,
        sequence_id : data.sequence_id
      },
      time: new Date().toISOString(),
    };

    const encryptedPayload = this.encryptionService.encrypt(payload);

    const baseUrl = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_BASE_URL',
    );

    const serviceId = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_SERVICE_ID',
    );

    const response = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}/action`,
        {
          payload: encryptedPayload,
          serviceId,
        },
        this.getAuthConfig(),
      ),
    );

    return response.data;
  }

  async getTransferInfo(data: {
    tracking_id?: string;
    unique_id?: string;
    sequence_id?: number;
  }) {
    const payload: Record<string, unknown> = {
      action: 'info',
      time: new Date().toISOString(),
    };

    if (data.tracking_id) {
      payload.tracking_id = data.tracking_id;
    } else if (
      data.unique_id &&
      data.sequence_id !== undefined
    ) {
      payload.unique_id = data.unique_id;
      payload.sequence_id = data.sequence_id;
    } else {
      throw new Error(
        'Either tracking_id or unique_id + sequence_id is required',
      );
    }

    const baseUrl = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_BASE_URL',
    );

    const serviceId = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_SERVICE_ID',
    );

    const response = await firstValueFrom(
        this.httpService.post(
        `${baseUrl}/info`,
        payload,
        this.getAuthConfig(),
        ),
    );
    return response.data;
  }

  private getAuthConfig() {
    const username = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_USERNAME',
    );

    const password = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_PASSWORD',
    );

    return {
      auth: {
        username,
        password,
      },
    };
  }

  async getBalance(data: {
    address: string;
  }) {
    
    const baseUrl = this.configService.getOrThrow<string>(
      'PALIZ_WALLET_BASE_URL',
    );
      const currency = this.configService.getOrThrow<string>(
        'PALIZ_WALLET_CURRENCY',
      );

    const payload: Record<string, unknown> = {
      address: data.address,
      currency,
    };

    const response = await firstValueFrom(
        this.httpService.post(
        `${baseUrl}/balance`,
        payload,
        this.getAuthConfig(),
        ),
    );
    return response.data;
  }

}