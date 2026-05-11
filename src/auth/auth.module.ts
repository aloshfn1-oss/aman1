import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_ACCESS_SECRET, signOptions: { expiresIn: '1h' } })],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, RedisService],
  exports: [AuthService],
})
export class AuthModule {}
