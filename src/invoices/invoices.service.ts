import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

 async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
  const user = await this.userRepository.findOne({
    where: { mobile: dto.mobile },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const invoice = this.invoiceRepository.create({
    userId: user.id,
    amount: dto.amount,
  });

  return this.invoiceRepository.save(invoice);
}
}