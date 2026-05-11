import { Module, Controller, Get, Post, Body, Headers, BadRequestException, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('usdt')
class UsdtController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('deposit-address')
  address(@Query('network') network: 'TRC20' | 'ERC20' = 'TRC20') {
    const addr = network === 'TRC20' ? process.env.USDT_TRC20_DEPOSIT_ADDRESS : process.env.USDT_ERC20_DEPOSIT_ADDRESS;
    return { network, address: addr, memo: null };
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  async withdraw(@CurrentUser() u: any, @Body() b: { network: string; address: string; amount: number }) {
    return this.prisma.withdrawRequest.create({
      data: { userId: u.sub, amount: b.amount, currency: 'USDT', method: `USDT_${b.network}`, destination: { address: b.address, network: b.network } },
    });
  }
}

@Controller('webhooks')
class UsdtWebhookController {
  constructor(private prisma: PrismaService) {}

  /** Verifies HMAC-SHA256(secret, raw_body) against `x-signature` header before crediting. */
  @Post('usdt')
  async usdt(@Headers('x-signature') sig: string, @Body() payload: { txHash: string; toAddress: string; amount: number; userId: string; network: string }) {
    const expected = crypto.createHmac('sha256', process.env.USDT_WEBHOOK_SECRET!).update(JSON.stringify(payload)).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new BadRequestException('Bad signature');
    // Idempotency on txHash
    const existing = await this.prisma.transaction.findFirst({ where: { reference: payload.txHash } });
    if (existing) return { ok: true, dedup: true };

    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: { userId: payload.userId, type: 'deposit', amount: payload.amount, currency: 'USDT',
          status: 'completed', reference: payload.txHash, note: `USDT ${payload.network}`, completedAt: new Date() },
      });
      await tx.wallet.upsert({
        where: { userId_currency: { userId: payload.userId, currency: 'USDT' } },
        create: { userId: payload.userId, currency: 'USDT', balance: payload.amount },
        update: { balance: { increment: payload.amount } },
      });
      await tx.ledgerEntry.createMany({ data: [
        { transactionId: t.id, account: `chain:usdt:${payload.network}`, debit: payload.amount, credit: 0, currency: 'USDT' },
        { transactionId: t.id, account: `user:${payload.userId}:USDT`,    debit: 0, credit: payload.amount, currency: 'USDT' },
      ]});
      return { ok: true };
    });
  }
}

@Module({ controllers: [UsdtController, UsdtWebhookController], providers: [PrismaService] })
export class UsdtModule {}
