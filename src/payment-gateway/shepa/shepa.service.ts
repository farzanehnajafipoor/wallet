import { Injectable, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  PaymentGateway,
  CreatePaymentRequestInput,
  CreatePaymentRequestOutput,
  VerifyPaymentInput,
  VerifyPaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
} from '../payment-gateway.interface.js';

interface ShepaEnvelope<T> {
  success: boolean;
  result?: T;
  errors?: string[] | string;
}

@Injectable()
export class ShepaService implements PaymentGateway {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestOutput> {
    const payload = {
      api: this.apiCode(),
      amount: input.amount,
      callback: input.callback,
      mobile: input.mobile,
      email: input.email,
      description: input.description,
    };

    const { data } = await firstValueFrom(
      this.httpService.post<ShepaEnvelope<{ token: string; url: string }>>(
        `${this.baseUrl()}/token`,
        payload,
      ),
    );

    if (!data.success || !data.result) {
      throw new BadGatewayException(
        `Shepa token request failed: ${this.formatErrors(data.errors)}`,
      );
    }

    return {
      authority: data.result.token,
      redirectUrl: data.result.url,
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentOutput> {
    const payload = {
      token: input.authority,
      amount: input.amount,
      api: this.apiCode(),
    };

    const { data } = await firstValueFrom(
      this.httpService.post<
        ShepaEnvelope<{
          refid: number;
          transaction_id: number;
          amount: number;
          card_pan?: string;
          date: string;
        }>
      >(`${this.baseUrl()}/verify`, payload),
    );

    if (!data.success || !data.result) {
      return {
        success: false,
        refId: '',
        transactionId: '',
        amount: input.amount,
        raw: data,
      };
    }

    return {
      success: true,
      refId: String(data.result.refid),
      transactionId: String(data.result.transaction_id),
      amount: data.result.amount,
      cardPan: data.result.card_pan,
      paidAt: new Date(data.result.date),
      raw: data,
    };
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentOutput> {
    const payload = {
      api: this.apiCode(),
      amount: input.amount,
      transaction_id: input.transactionId,
    };

    // Refund always goes to the production endpoint — the docs only list
    // sandbox URLs for /token and /verify, not /refund-transaction.
    const { data } = await firstValueFrom(
      this.httpService.post<ShepaEnvelope<string>>(
        `https://merchant.shepa.com/api/v1/refund-transaction`,
        payload,
      ),
    );

    if (!data.success || !data.result) {
      throw new BadGatewayException(
        `Shepa refund failed: ${this.formatErrors(data.errors)}`,
      );
    }

    return {
      success: true,
      refundTrackingCode: data.result,
    };
  }

  private isSandbox(): boolean {
    return this.configService.get<string>('SHEPA_ENV') === 'sandbox';
  }

  private baseUrl(): string {
    return this.isSandbox()
      ? 'https://sandbox.shepa.com/api/v1'
      : 'https://merchant.shepa.com/api/v1';
  }

  private apiCode(): string {
    return this.isSandbox()
      ? 'sandbox'
      : this.configService.getOrThrow<string>('SHEPA_API_KEY');
  }

  private formatErrors(errors: string[] | string | undefined): string {
    if (!errors) return 'unknown error';
    return Array.isArray(errors) ? errors.join(', ') : errors;
  }
}