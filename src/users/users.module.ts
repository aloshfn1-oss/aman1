import { Module, Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
class UsersController {
  constructor(private prisma: PrismaService) {}
  @Get() list(@CurrentUser() u: any) {
    // TODO: real implementation per docs in README.md
    return { module: 'users', user: u.sub };
  }
}

@Module({ controllers: [UsersController], providers: [PrismaService] })
export class UsersModule {}
