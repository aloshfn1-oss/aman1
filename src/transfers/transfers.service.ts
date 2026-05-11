import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  /** Atomic transfer with double-entry ledger and idempotency. */
  async transfer(fromUserId: string, toPublicId: string, amount: number, currency: Currency, idempotencyKey: string, note?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    // idempotency at DB level (idempotencyKey is unique)
    if (idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const recipient = await tx.user.findUnique({ where: { publicId: toPublicId } });
      if (!recipient) throw new NotFoundException('Recipient not found');
      if (recipient.id === fromUserId) throw new BadRequestException('Cannot transfer to self');

      // SELECT ... FOR UPDATE on sender wallet (raw — Prisma lacks first-class row-locking)
      const [{ balance }] = await tx.$queryRaw<{ balance: any }[]>(
        Prisma.sql`SELECT balance FROM "Wallet" WHERE "userId" = ${fromUserId} AND currency = ${currency}::"Currency" FOR UPDATE`
      );
      if (Number(balance) < amount) throw new BadRequestException('Insufficient balance');

      const reference = 'RCPT-' + crypto.randomBytes(5).toString('hex').toUpperCase();

      const txOut = await tx.transaction.create({
        data: {
          userId: fromUserId, counterpartyId: recipient.id,
          type: 'transfer_out', amount, currency, status: 'completed',
          reference, idempotencyKey, note, completedAt: new Date(),
        },
      });
      await tx.transaction.create({
        data: {
          userId: recipient.id, counterpartyId: fromUserId,
          type: 'transfer_in', amount, currency, status: 'completed',
          reference, note, completedAt: new Date(),
        },
      });

      await tx.wallet.update({ where: { userId_currency: { userId: fromUserId, currency } }, data: { balance: { decrement: amount } } });
      await tx.wallet.upsert({
        where: { userId_currency: { userId: recipient.id, currency } },
        create: { userId: recipient.id, currency, balance: amount },
        update: { balance: { increment: amount } },
      });

      // Double-entry ledger
      await tx.ledgerEntry.createMany({
        data: [
          { transactionId: txOut.id, account: `user:${fromUserId}:${currency}`,    debit: amount, credit: 0, currency },
          { transactionId: txOut.id, account: `user:${recipient.id}:${currency}`, debit: 0, credit: amount, currency },
        ],
      });
      return txOut;
    });
  }
}
