import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PalizWalletService } from './paliz-wallet.service.js';
import { PalizEncryptionService } from './paliz-encryption.service.js';

@Module({
  imports: [HttpModule],
  providers: [PalizWalletService, PalizEncryptionService],
  exports: [PalizWalletService],
})
export class PalizWalletModule {}