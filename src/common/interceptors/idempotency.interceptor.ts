import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ConflictException } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';

/** Requires header `Idempotency-Key`. Caches successful responses for 24h. */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private redis: RedisService) {}
  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'];
    if (!key) return next.handle();

    const cacheKey = `idem:${req.user?.sub || 'anon'}:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return of(JSON.parse(cached));

    const lock = await this.redis.setNx(`${cacheKey}:lock`, '1', 30);
    if (!lock) throw new ConflictException('Duplicate in-flight request');

    return next.handle().pipe(
      tap(async (data) => {
        await this.redis.client.set(cacheKey, JSON.stringify(data), 'EX', 86400);
        await this.redis.del(`${cacheKey}:lock`);
      }),
    );
  }
}
