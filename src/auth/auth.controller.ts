import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/request')
  request(@Body() body: { phone: string }) { return this.auth.requestOtp(body.phone); }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('otp/verify')
  verify(@Body() body: { phone: string; code: string }) { return this.auth.verifyOtp(body.phone, body.code); }

  @Post('admin/login')
  admin(@Body() body: { phone: string; password: string }) { return this.auth.loginAdmin(body.phone, body.password); }

  @Post('refresh')
  refresh(@Body() body: { refresh_token: string }) { return this.auth.refresh(body.refresh_token); }
}
