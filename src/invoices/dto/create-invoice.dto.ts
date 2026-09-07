import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsInt()
  @IsPositive()
  amount: number;
}