import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ServiceCallCounter } from './entities/service-call-counter.entity.js';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PalizCallCounterService {
  constructor(
    @InjectRepository(ServiceCallCounter)
    private readonly repo: Repository<ServiceCallCounter>,
  ) {}

  async increment(serviceId: string): Promise<void> {
    const result = await this.repo.increment({ serviceId }, 'count', 1);

    if (result.affected === 0) {
        const insertResult = await this.repo
        .createQueryBuilder()
        .insert()
        .values({ serviceId, count: '1' })
        .orIgnore()
        .execute();

        const wasInserted = insertResult.identifiers.length > 0;

        if (!wasInserted) {
        await this.repo.increment({ serviceId }, 'count', 1).catch(() => {});
        }
    }
    }

async incrementAndGet(serviceId: string): Promise<number> {
    const result = await this.repo.query(
      `INSERT INTO service_call_counters ("serviceId", count, "updatedAt")
       VALUES ($1, 1, now())
       ON CONFLICT ("serviceId")
       DO UPDATE SET count = service_call_counters.count + 1, "updatedAt" = now()
       RETURNING count`,
      [serviceId],
    );

    return Number(result[0].count);
  }
}