import { Module, Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
class TransactionsController {
  constructor(private prisma: PrismaService) {}
  @Get() list(@CurrentUser() u: any) {
    // TODO: real implementation per docs in README.md
    return { module: 'transactions', user: u.sub };
  }
}

@Module({ controllers: [TransactionsController], providers: [PrismaService] })
export class TransactionsModule {}
