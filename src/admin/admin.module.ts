import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Module({ controllers: [AdminController], providers: [AdminService, PrismaService, NotificationsGateway] })
export class AdminModule {}
