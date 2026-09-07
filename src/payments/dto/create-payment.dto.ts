import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity.js';

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsInt()
  @IsPositive()
  amount: number;
}