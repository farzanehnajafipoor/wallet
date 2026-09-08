import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity.js';

export class PayInvoiceDto {
  @IsUUID()
  invoiceId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}