import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Wallet } from './entities/wallet.entity.js';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, User])],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}