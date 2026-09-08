import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { WalletsService } from '../wallets/wallets.service.js';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly walletsService: WalletsService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto) {
    const user = await this.userRepository.findOne({
      where: { mobile: dto.mobile },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create invoice
    const invoice = this.invoiceRepository.create({
      userId: user.id,
      amount: dto.amount,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Get latest wallet balance from Paliz
    const walletBalance = await this.walletsService.getMyWalletBalance(
      dto.mobile,
    );

    const invoiceAmount = Number(savedInvoice.amount);

    const paymentMethods = [];

    if (walletBalance >= invoiceAmount) {
      // Wallet can cover the whole invoice
      paymentMethods.push(
        {
          paymentMethod: 'wallet',
          walletAmount: invoiceAmount,
          gatewayAmount: 0,
        },
        {
          paymentMethod: 'gateway',
          walletAmount: 0,
          gatewayAmount: invoiceAmount,
        },
      );
    } else {
      // Wallet cannot cover the whole invoice
      paymentMethods.push(
        {
          paymentMethod: 'gateway',
          walletAmount: 0,
          gatewayAmount: invoiceAmount,
        },
        {
          paymentMethod: 'combine',
          walletAmount: walletBalance,
          gatewayAmount: invoiceAmount - walletBalance,
        },
      );
    }

    return {
      ...savedInvoice,
      paymentMethods,
    };
  }
}