import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PalizWalletService } from './paliz-wallet.service.js';
import { PalizEncryptionService } from './paliz-encryption.service.js';
import { PalizCallCounterService } from './paliz-call-counter.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCallCounter } from './entities/service-call-counter.entity.js';
import { PalizTransferService } from './paliz-transfer.service.js';
import { PalizTransfer } from './entities/paliz-transfer.entity.js';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([ServiceCallCounter, PalizTransfer])],
  providers: [
    PalizWalletService,
    PalizEncryptionService,
    PalizCallCounterService,
    PalizTransferService,
  ],
  exports: [PalizWalletService, PalizCallCounterService, PalizTransferService],
})
export class PalizWalletModule {}
