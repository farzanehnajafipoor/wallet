import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PAYMENT_GATEWAY } from './payment-gateway.interface.js';
import { ShepaService } from './shepa/shepa.service.js';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useClass: ShepaService,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentGatewayModule {}
