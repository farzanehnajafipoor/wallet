import {
  Injectable,
} from '@nestjs/common';
import { WalletsService } from '../wallets/wallets.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly walletsService: WalletsService,
  ) {}

}