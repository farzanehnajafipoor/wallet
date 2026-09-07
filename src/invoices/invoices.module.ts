import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, User])],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}