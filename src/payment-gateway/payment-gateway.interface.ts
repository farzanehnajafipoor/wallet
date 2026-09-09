export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreatePaymentRequestInput {
  idempotencyKey: string;
  amount: number;
  callback: string;
  mobile?: string;
  email?: string;
  description?: string;
}

export interface CreatePaymentRequestOutput {
  authority: string;
  redirectUrl: string;
}

export interface VerifyPaymentInput {
  authority: string;
  amount: number;
  token?: string;
}

export interface VerifyPaymentOutput {
  success: boolean;
  refId: string;
  transactionId: string;
  amount: number;
  cardPan?: string;
  paidAt?: Date;
  raw: unknown;
}

export interface RefundPaymentInput {
  transactionId: string;
  amount: number;
}

export interface RefundPaymentOutput {
  success: boolean;
  refundTrackingCode: string;
}

export interface PaymentGateway {
  createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatePaymentRequestOutput>;

  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentOutput>;

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>;
}
