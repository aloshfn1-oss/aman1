import { Module, Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const GOLD_PRICE_USD_PER_GRAM = 75; // TODO: pull live from a price oracle / admin config

@Controller('gold')
class GoldController {
  constructor(private prisma: PrismaService) {}

  @Get('price') price() { return { usd_per_gram: GOLD_PRICE_USD_PER_GRAM, ts: new Date() }; }

  @UseGuards(JwtAuthGuard)
  @Post('buy')
  async buy(@CurrentUser() u: any, @Body() b: { grams: number }) {
    const cost = b.grams * GOLD_PRICE_USD_PER_GRAM;
    return this.prisma.$transaction(async (tx) => {
      const usd = await tx.wallet.findUnique({ where: { userId_currency: { userId: u.sub, currency: 'USD' } } });
      if (!usd || Number(usd.balance) < cost) throw new Error('Insufficient USD');
      const t = await tx.transaction.create({ data: { userId: u.sub, type: 'exchange', amount: cost, currency: 'USD', status: 'completed', completedAt: new Date(), note: `Buy ${b.grams}g gold` } });
      await tx.wallet.update({ where: { userId_currency: { userId: u.sub, currency: 'USD' } }, data: { balance: { decrement: cost } } });
      await tx.wallet.upsert({
        where: { userId_currency: { userId: u.sub, currency: 'GOLD' } },
        create: { userId: u.sub, currency: 'GOLD', balance: b.grams },
        update: { balance: { increment: b.grams } },
      });
      await tx.ledgerEntry.createMany({ data: [
        { transactionId: t.id, account: `user:${u.sub}:USD`,  debit: cost, credit: 0, currency: 'USD' },
        { transactionId: t.id, account: `system:gold-vault`,  debit: 0, credit: cost, currency: 'USD' },
        { transactionId: t.id, account: `system:gold-vault`,  debit: b.grams, credit: 0, currency: 'GOLD' },
        { transactionId: t.id, account: `user:${u.sub}:GOLD`, debit: 0, credit: b.grams, currency: 'GOLD' },
      ]});
      return t;
    });
  }

  // sell mirrors buy — omitted for brevity
}

@Module({ controllers: [GoldController], providers: [PrismaService] })
export class GoldModule {}
