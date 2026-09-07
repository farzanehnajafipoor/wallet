import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Wallet } from './entities/wallet.entity.js';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreateWallet(mobile: string): Promise<Wallet> {
    const user = await this.userRepository.findOne({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingWallet = await this.walletRepository.findOne({
      where: { userId: user.id },
    });

    if (existingWallet) {
      return existingWallet;
    }

    const wallet = this.walletRepository.create({
      userId: user.id,
      balance: 0,
    });

    return this.walletRepository.save(wallet);
  }

  async getWalletByMobile(mobile: string): Promise<Wallet> {
    const user = await this.userRepository.findOne({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallet = await this.walletRepository.findOne({
      where: { userId: user.id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }
}