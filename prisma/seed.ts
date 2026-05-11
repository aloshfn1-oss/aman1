import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const db = new PrismaClient();

async function main() {
  // Bootstrap admin
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE || '+963999999999';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe#123';
  const hash = await argon2.hash(password);
  const admin = await db.user.upsert({
    where: { phone },
    update: { password: hash },
    create: {
      phone, password: hash, fullName: 'Admin',
      roles: { create: { role: 'admin' } },
      wallets: { create: [{ currency: 'SYP' }, { currency: 'USD' }, { currency: 'USDT' }, { currency: 'GOLD' }] },
    },
  });
  console.log('Admin ready:', admin.phone);

  // Default config
  const cfg: Record<string, any> = {
    exchange: { buyRate: 14600, sellRate: 14400 },
    fees: { deposit: 0.5, withdraw: 1.5, transfer: 0, exchange: 1 },
    contact: { whatsapp: '963999999999', telegram: 'amanbank', supportPhone: '+963 11 234 5678' },
    bank: { name: 'بنك سوريا الدولي الإسلامي', accountHolder: 'شركة أمان', iban: 'SY00...', swift: 'SIIBSYDA' },
  };
  for (const [k, v] of Object.entries(cfg)) {
    await db.appConfig.upsert({ where: { key: k }, create: { key: k, value: v }, update: { value: v } });
  }

  // Sample plans
  await db.investmentPlan.createMany({
    data: [
      { name: 'خطة البداية',    profitRate: 0.8, profitType: 'daily',   duration: 30, durationUnit: 'يوم', minAmount: 50,  maxAmount: 1000,  risk: 'low',    badge: 'آمن' },
      { name: 'محفظة النمو',    profitRate: 12,  profitType: 'monthly', duration: 3,  durationUnit: 'شهر', minAmount: 200, maxAmount: 10000, risk: 'medium', badge: 'متوازن', featured: true },
    ],
    skipDuplicates: true,
  });
  console.log('Seed complete');
}
main().finally(() => db.$disconnect());
