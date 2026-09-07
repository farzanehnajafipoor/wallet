import { Body, Controller, Post } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }
}