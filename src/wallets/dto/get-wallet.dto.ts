import { IsNotEmpty, IsString } from 'class-validator';

export class GetWalletDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;
}