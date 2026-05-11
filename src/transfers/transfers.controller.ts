import { Body, Controller, Headers, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { TransfersService } from './transfers.service';
import { Currency } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private svc: TransfersService) {}

  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  async create(
    @CurrentUser() u: { sub: string },
    @Headers('idempotency-key') key: string,
    @Body() dto: { to_public_id: string; amount: number; currency: Currency; note?: string },
  ) {
    return this.svc.transfer(u.sub, dto.to_public_id, dto.amount, dto.currency, key, dto.note);
  }
}
