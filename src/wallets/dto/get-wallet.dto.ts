import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetWalletDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobile: string;
}
