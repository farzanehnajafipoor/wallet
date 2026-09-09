import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity.js';
import { ApiProperty } from '@nestjs/swagger';

export class PayInvoiceDto {
  @ApiProperty()
  @IsUUID()
  invoiceId: string;

  @ApiProperty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
