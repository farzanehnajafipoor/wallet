import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { WalletsService } from './wallets.service.js';
import { GetWalletDto } from './dto/get-wallet.dto.js';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  createWallet(@Body() dto: CreateWalletDto) {
    return this.walletsService.findOrCreateWallet(dto.mobile);
  }

  @Get()
  getWallet(@Query() dto: GetWalletDto) {
    return this.walletsService.getWalletByMobile(dto.mobile);
  }
}