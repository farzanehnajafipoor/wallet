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
  authority: string;     // gateway's reference for this attempt (Shepa: token)
  redirectUrl: string;   // where to send the user's browser
}

export interface VerifyPaymentInput {
  authority: string;     // same token/authority from createPaymentRequest
  amount: number;
}

export interface VerifyPaymentOutput {
  success: boolean;
  refId: string;
  transactionId: string;
  amount: number;
  cardPan?: string;
  paidAt?: Date;
  raw: unknown;           // keep the raw response for debugging/audit
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
  createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestOutput>;

  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentOutput>;

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>;
}