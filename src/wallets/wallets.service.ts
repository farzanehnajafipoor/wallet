import { Injectable, NotFoundException, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity.js';
import { Wallet } from './entities/wallet.entity.js';
import { PalizWalletService } from '../paliz-wallet/paliz-wallet.service.js';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly palizWalletService: PalizWalletService,
  ) {}

  async getMyWalletBalance(mobile: string) {
    const user = await this.userRepository.findOne({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.refreshWalletBalance(user.id);
  }

  private async getPalizWalletBalance(walletAddress: string): Promise<number> {
    try {
      const palizResponse = await this.palizWalletService.getBalance({
        address: walletAddress,
      });
      return palizResponse.data.wallet_balance;
    } catch (error) {
      throw new BadGatewayException(`Unable to get wallet balance from Paliz message:${error}`);
    }
  }

  async refreshWalletBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.walletAddress) {
      throw new NotFoundException('User wallet address not found');
    }

    const balance = await this.getPalizWalletBalance(user.walletAddress);

    let wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId,
        balance: balance.toString(),
      });
    } else {
      wallet.balance = balance.toString();
    }

    await this.walletRepository.save(wallet);

    return balance;
  }
}
