import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

   @Get(':id/paliz-info')
    getPalizInfo(@Param('id') id: string) {
      return this.paymentsService.getPalizInfo(id);
    }
}