import { Injectable } from '@nestjs/common';
import { privateEncrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PalizEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(payload: object): string {
    console.log('input payload:', payload);
    const keyPath = this.configService.get<string>('PALIZ_WALLET_PRIVATE_KEY_PATH');

    if (!keyPath) {
      throw new Error('PALIZ_WALLET_PRIVATE_KEY_PATH is not configured');
    }

    const privateKey = readFileSync(keyPath, 'utf8');
    const data = Buffer.from(JSON.stringify(payload), 'utf8');

    const encrypted = privateEncrypt(
      {
        key: privateKey,
        padding: 1,
      },
      data,
    );

    return encrypted.toString('base64');
  }
}
