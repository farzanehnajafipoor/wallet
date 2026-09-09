import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity.js';
import { User } from '../users/entities/user.entity.js';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';
import { PalizWalletModule } from '../paliz-wallet/paliz-wallet.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, User]), PalizWalletModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
