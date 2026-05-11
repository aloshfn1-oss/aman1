import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---------- Users
  listUsers(q?: string, page = 1) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ phone: { contains: q } }, { fullName: { contains: q, mode: 'insensitive' } }, { publicId: { contains: q } }] } : undefined,
      take: 50, skip: (page - 1) * 50, include: { wallets: true, roles: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  setUserStatus(id: string, status: 'active' | 'suspended') {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  // ---------- Balance adjustment with double-entry
  async adjustBalance(adminId: string, userId: string, currency: Currency, delta: number, note: string) {
    return this.prisma.$transaction(async (tx) => {
      const ref = 'ADM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
      const txn = await tx.transaction.create({
        data: {
          userId, type: delta >= 0 ? 'admin_credit' : 'admin_debit',
          amount: Math.abs(delta), currency, status: 'completed', reference: ref, note, completedAt: new Date(),
        },
      });
      await tx.wallet.upsert({
        where: { userId_currency: { userId, currency } },
        create: { userId, currency, balance: Math.max(delta, 0) },
        update: { balance: { increment: delta } },
      });
      await tx.ledgerEntry.createMany({
        data: [
          { transactionId: txn.id, account: `system:treasury:${currency}`, debit: delta > 0 ? delta : 0, credit: delta < 0 ? -delta : 0, currency },
          { transactionId: txn.id, account: `user:${userId}:${currency}`,   debit: delta < 0 ? -delta : 0, credit: delta > 0 ? delta : 0, currency },
        ],
      });
      await tx.adminAuditLog.create({ data: { adminId, action: 'adjust_balance', targetType: 'user', targetId: userId, details: { delta, currency, note } } });
      return txn;
    });
  }

  // ---------- Plans
  createPlan(data: Prisma.InvestmentPlanCreateInput) { return this.prisma.investmentPlan.create({ data }); }
  updatePlan(id: string, data: Prisma.InvestmentPlanUpdateInput) { return this.prisma.investmentPlan.update({ where: { id }, data }); }
  deletePlan(id: string) { return this.prisma.investmentPlan.delete({ where: { id } }); }

  // ---------- Agents
  createAgent(data: Prisma.AgentCreateInput) { return this.prisma.agent.create({ data }); }
  updateAgent(id: string, data: Prisma.AgentUpdateInput) { return this.prisma.agent.update({ where: { id }, data }); }
  deleteAgent(id: string) { return this.prisma.agent.delete({ where: { id } }); }

  // ---------- Config (exchange rate, fees, contact info, bank info)
  getConfig() { return this.prisma.appConfig.findMany(); }
  setConfig(key: string, value: any, adminId: string) {
    return this.prisma.appConfig.upsert({ where: { key }, create: { key, value, updatedBy: adminId }, update: { value, updatedBy: adminId } });
  }

  // ---------- Admin accounts
  listAdmins() { return this.prisma.user.findMany({ where: { roles: { some: { role: 'admin' } } }, select: { id: true, phone: true, fullName: true, createdAt: true } }); }
  async createAdmin(phone: string, password: string, fullName?: string) {
    const hash = await argon2.hash(password);
    return this.prisma.user.upsert({
      where: { phone },
      update: { password: hash, roles: { connectOrCreate: { where: { userId_role: { userId: '', role: 'admin' } }, create: { role: 'admin' } } } },
      create: { phone, fullName, password: hash, roles: { create: { role: 'admin' } } },
    });
  }
  async changeAdminPassword(id: string, newPassword: string) {
    return this.prisma.user.update({ where: { id }, data: { password: await argon2.hash(newPassword) } });
  }
  removeAdmin(id: string) { return this.prisma.userRole.deleteMany({ where: { userId: id, role: 'admin' } }); }

  // ---------- KYC review
  reviewKyc(id: string, reviewerId: string, status: 'approved' | 'rejected', reason?: string) {
    return this.prisma.kycRequest.update({
      where: { id },
      data: { status, reviewerId, rejectionReason: reason, reviewedAt: new Date() },
    });
  }

  // ---------- Deposits / Withdrawals review
  reviewDeposit(id: string, reviewerId: string, approve: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.depositRequest.update({
        where: { id }, data: { status: approve ? 'approved' : 'rejected', reviewerId, reviewedAt: new Date() },
      });
      if (approve) {
        await this.adjustBalance(reviewerId, r.userId, r.currency, Number(r.amount), `Deposit ${r.id}`);
      }
      return r;
    });
  }
  reviewWithdraw(id: string, reviewerId: string, approve: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.withdrawRequest.update({
        where: { id }, data: { status: approve ? 'approved' : 'rejected', reviewerId, reviewedAt: new Date() },
      });
      if (approve) {
        await this.adjustBalance(reviewerId, r.userId, r.currency, -Number(r.amount), `Withdraw ${r.id}`);
      }
      return r;
    });
  }
}
