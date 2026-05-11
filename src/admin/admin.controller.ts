import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { Currency } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  // Users
  @Get('users') users(@Query('q') q?: string, @Query('page') p?: string) { return this.svc.listUsers(q, Number(p) || 1); }
  @Patch('users/:id/status') status(@Param('id') id: string, @Body() b: { status: 'active'|'suspended' }) { return this.svc.setUserStatus(id, b.status); }
  @Post('users/:id/balance') adjust(@CurrentUser() a: any, @Param('id') id: string, @Body() b: { currency: Currency; delta: number; note: string }) {
    return this.svc.adjustBalance(a.sub, id, b.currency, b.delta, b.note);
  }

  // KYC / Deposits / Withdraws
  @Patch('kyc/:id') reviewKyc(@CurrentUser() a: any, @Param('id') id: string, @Body() b: { status: 'approved'|'rejected'; reason?: string }) {
    return this.svc.reviewKyc(id, a.sub, b.status, b.reason);
  }
  @Patch('deposits/:id') reviewDep(@CurrentUser() a: any, @Param('id') id: string, @Body() b: { approve: boolean }) {
    return this.svc.reviewDeposit(id, a.sub, b.approve);
  }
  @Patch('withdrawals/:id') reviewWd(@CurrentUser() a: any, @Param('id') id: string, @Body() b: { approve: boolean }) {
    return this.svc.reviewWithdraw(id, a.sub, b.approve);
  }

  // Plans
  @Post('plans')         createPlan(@Body() b: any) { return this.svc.createPlan(b); }
  @Patch('plans/:id')    updatePlan(@Param('id') id: string, @Body() b: any) { return this.svc.updatePlan(id, b); }
  @Delete('plans/:id')   deletePlan(@Param('id') id: string) { return this.svc.deletePlan(id); }

  // Agents
  @Post('agents')        createAgent(@Body() b: any) { return this.svc.createAgent(b); }
  @Patch('agents/:id')   updateAgent(@Param('id') id: string, @Body() b: any) { return this.svc.updateAgent(id, b); }
  @Delete('agents/:id')  deleteAgent(@Param('id') id: string) { return this.svc.deleteAgent(id); }

  // Config (exchange rate, fees, whatsapp, telegram, bank info, deposit instructions)
  @Get('config')                  getConfig() { return this.svc.getConfig(); }
  @Put('config/:key')             putConfig(@CurrentUser() a: any, @Param('key') k: string, @Body() v: any) { return this.svc.setConfig(k, v, a.sub); }

  // Admin accounts
  @Get('admins')                  listAdmins() { return this.svc.listAdmins(); }
  @Post('admins')                 addAdmin(@Body() b: { phone: string; password: string; fullName?: string }) { return this.svc.createAdmin(b.phone, b.password, b.fullName); }
  @Patch('admins/:id/password')   changePw(@Param('id') id: string, @Body() b: { password: string }) { return this.svc.changeAdminPassword(id, b.password); }
  @Delete('admins/:id')           removeAdmin(@Param('id') id: string) { return this.svc.removeAdmin(id); }
}
