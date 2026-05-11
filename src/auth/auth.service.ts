import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private redis: RedisService, private jwt: JwtService) {}

  async requestOtp(phone: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttl = Number(process.env.OTP_TTL_SECONDS || 300);
    await this.redis.client.set(`otp:${phone}`, code, 'EX', ttl);
    // TODO: send SMS via OTP_PROVIDER. In dev, log it.
    if (process.env.OTP_PROVIDER === 'mock') console.log(`[OTP] ${phone} → ${code}`);
    return { sent: true, ttl };
  }

  async verifyOtp(phone: string, code: string) {
    const expected = await this.redis.get(`otp:${phone}`);
    if (!expected || expected !== code) throw new UnauthorizedException('Invalid OTP');
    await this.redis.del(`otp:${phone}`);

    let user = await this.prisma.user.findUnique({ where: { phone }, include: { roles: true } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          roles: { create: { role: 'user' } },
          wallets: { create: [{ currency: 'SYP' }, { currency: 'USD' }, { currency: 'USDT' }, { currency: 'GOLD' }] },
        },
        include: { roles: true },
      });
    }
    return this.issueTokens(user.id, user.roles.map(r => r.role));
  }

  async loginAdmin(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { phone }, include: { roles: true } });
    if (!user || !user.password) throw new UnauthorizedException();
    const ok = await argon2.verify(user.password, password);
    if (!ok) throw new UnauthorizedException();
    if (!user.roles.some(r => r.role === 'admin')) throw new UnauthorizedException('Not an admin');
    return this.issueTokens(user.id, user.roles.map(r => r.role));
  }

  private async issueTokens(sub: string, roles: string[]) {
    const access = await this.jwt.signAsync({ sub, roles }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '1h' });
    const refresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refresh).digest('hex');
    await this.prisma.refreshToken.create({
      data: { userId: sub, tokenHash, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    });
    return { access_token: access, refresh_token: refresh };
  }

  async refresh(refresh: string) {
    const tokenHash = crypto.createHash('sha256').update(refresh).digest('hex');
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row || row.revoked || row.expiresAt < new Date()) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, include: { roles: true } });
    if (!user) throw new UnauthorizedException();
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revoked: true } });
    return this.issueTokens(user.id, user.roles.map(r => r.role));
  }
}
