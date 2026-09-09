import { Body, Controller, Post, Get, Param, Query } from '@nestjs/common';
import { PayInvoiceDto } from './dto/pay-invoice.dto.js';
import { PaymentOrchestratorService } from './payment-orchestrator.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentOrchestratorService: PaymentOrchestratorService) {}

  @Post()
  pay(@Body() dto: PayInvoiceDto) {
    return this.paymentOrchestratorService.pay(dto.invoiceId, dto.paymentMethod);
  }

  @Get('gateway/callback/:paymentId')
  handleGatewayCallback(
    @Param('paymentId') paymentId: string,
    @Query('token') token: string,
    @Query('status') status: string,
  ) {
    return this.paymentOrchestratorService.handleGatewayCallback(paymentId, token, status);
  }

  @Post(':paymentId/refund')
  refund(@Param('paymentId') paymentId: string) {
    return this.paymentOrchestratorService.refund(paymentId);
  }
}
