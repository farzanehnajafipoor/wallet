import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { PayInvoiceDto } from './dto/pay-invoice.dto.js';
import { PaymentOrchestratorService } from './payment-orchestrator.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentOrchestratorService: PaymentOrchestratorService,
  ) {}

  
 @Post()
  pay(@Body() dto: PayInvoiceDto) {
    return this.paymentOrchestratorService.pay(
      dto.invoiceId,
      dto.paymentMethod,
    );
  }

}