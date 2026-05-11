import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  constructor() { this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); }
  onModuleDestroy() { this.client.disconnect(); }

  async setNx(key: string, value: string, ttlSec: number): Promise<boolean> {
    const r = await this.client.set(key, value, 'EX', ttlSec, 'NX');
    return r === 'OK';
  }
  async get(key: string) { return this.client.get(key); }
  async del(key: string) { return this.client.del(key); }
}
