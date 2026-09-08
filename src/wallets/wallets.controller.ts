import { Controller, Get, Query } from '@nestjs/common';

import { WalletsService } from './wallets.service.js';
import { GetWalletDto } from './dto/get-wallet.dto.js';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getWallet(@Query() dto: GetWalletDto) {
    return this.walletsService.getMyWalletBalance(dto.mobile);
  }
}
