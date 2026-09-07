import { Body, Controller, Post } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.createInvoice(dto);
  }
}