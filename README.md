# Aman Finance — NestJS Backend (مرجعي)

Backend احترافي لتطبيق محفظة + تحويلات + استثمار + USDT/ذهب + لوحة تحكم Admin، مكتوب بـ **NestJS + Prisma + PostgreSQL + Redis + WebSockets + Docker**.

> ملاحظة: تطبيق Lovable الحي يعمل مع **Lovable Cloud (Postgres + Auth + RLS)**. هذا المجلد هو **بديل/مرجع** لمن يريد تشغيل سيرفر NestJS مستقل على بنيته التحتية. الهيكل والمنطق المالي (Ledger، Idempotency، RBAC) متطابقان مع منطق قاعدة البيانات في `supabase/migrations/`.

## الهيكل

```
backend/
  ├── docker-compose.yml         # Postgres + Redis + API
  ├── Dockerfile
  ├── .env.example
  ├── package.json
  ├── tsconfig.json
  ├── prisma/
  │   ├── schema.prisma          # نفس مخطط قاعدة البيانات
  │   └── seed.ts
  └── src/
      ├── main.ts
      ├── app.module.ts
      ├── common/                # guards, decorators, interceptors
      │   ├── guards/jwt-auth.guard.ts
      │   ├── guards/roles.guard.ts
      │   ├── decorators/roles.decorator.ts
      │   ├── decorators/current-user.decorator.ts
      │   └── interceptors/idempotency.interceptor.ts
      ├── prisma/prisma.service.ts
      ├── redis/redis.service.ts
      ├── auth/                  # OTP + JWT
      │   ├── auth.module.ts
      │   ├── auth.service.ts
      │   ├── auth.controller.ts
      │   ├── jwt.strategy.ts
      │   └── dto/
      ├── users/
      ├── wallets/
      ├── transfers/             # تحويلات بين المستخدمين (Ledger مزدوج)
      ├── transactions/
      ├── deposits/              # USDT/SYP/USD
      ├── withdrawals/
      ├── investments/
      ├── usdt/                  # شبكات TRC20/ERC20
      ├── gold/                  # محفظة ذهب رقمية
      ├── kyc/
      ├── notifications/         # WebSocket gateway
      ├── admin/                 # كل APIs لوحة التحكم
      └── reports/               # تحليلات
```

## التشغيل خطوة بخطوة

### 1) المتطلبات
- Docker + Docker Compose
- Node.js 20+ (للتطوير المحلي خارج docker)

### 2) تجهيز البيئة
```bash
cd backend
cp .env.example .env
# عدّل الأسرار: JWT_SECRET, OTP_PROVIDER_KEY, USDT_WEBHOOK_SECRET ...
```

### 3) إقلاع الخدمات بـ Docker
```bash
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

API على: `http://localhost:3000`
WebSocket على: `ws://localhost:3000/ws`
Swagger: `http://localhost:3000/docs`

### 4) إنشاء أول مدير
```bash
docker compose exec api node dist/scripts/create-admin.js \
  --phone +963999999999 --password StrongPass#123
```

### 5) أوامر مفيدة
```bash
docker compose logs -f api          # متابعة السجلات
docker compose exec db psql -U aman # دخول قاعدة البيانات
docker compose down -v              # إيقاف وحذف البيانات
```

## مميزات الأمان والمالية

- **Double-Entry Ledger**: كل عملية تكتب قيدين (مدين/دائن) في `ledger_entries`. مجموع المدين = مجموع الدائن دائماً.
- **Idempotency**: كل طلب POST مالي يحتاج هيدر `Idempotency-Key`. التكرار يعيد نفس النتيجة دون تنفيذ مزدوج (مخزّن في Redis لمدة 24 ساعة).
- **RBAC**: `@Roles('admin')` على المسارات الإدارية. الصلاحيات في جدول مستقل `user_roles`.
- **JWT + OTP**: تسجيل دخول برقم الهاتف → OTP عبر SMS → JWT صالح ساعة + Refresh Token صالح 30 يوم.
- **Atomic Transfers**: التحويل داخل `prisma.$transaction(...)` مع `SELECT ... FOR UPDATE` على المحفظة.
- **Rate Limiting**: `@nestjs/throttler` لحماية login/OTP/withdraw.
- **Webhooks USDT**: التحقق من توقيع HMAC-SHA256 قبل أي إيداع.

## مخطط API (مختصر)

### مصادقة
- `POST /auth/otp/request` — `{ phone }`
- `POST /auth/otp/verify` — `{ phone, code }` → `{ access_token, refresh_token }`
- `POST /auth/refresh` — `{ refresh_token }`
- `POST /auth/logout`

### المحفظة
- `GET  /wallets/me` — أرصدة (SYP, USD, USDT, GOLD)
- `GET  /transactions?page=&type=`
- `GET  /transactions/:id/receipt.pdf`

### التحويلات
- `POST /transfers` — `{ to_public_id, amount, currency, note }` + `Idempotency-Key`
- `POST /transfers/lookup` — `{ public_id | phone }`

### الإيداع/السحب
- `POST /deposits/bank` — رفع إيصال
- `POST /deposits/agent` — اختيار وكيل
- `POST /deposits/code` — كود شحن
- `POST /withdrawals` — `{ amount, currency, method, agent_id|destination }`

### USDT
- `GET  /usdt/deposit-address?network=TRC20`
- `POST /usdt/withdraw` — `{ network, address, amount }`
- `POST /webhooks/usdt` — (داخلي، HMAC)

### الذهب
- `GET  /gold/price` — السعر الحالي للأونصة
- `POST /gold/buy` — `{ grams }`
- `POST /gold/sell` — `{ grams }`

### الاستثمار
- `GET  /plans`
- `POST /investments` — `{ plan_id, amount }`
- `GET  /investments/me`

### KYC
- `POST /kyc` — رفع صور المستندات
- `GET  /kyc/me`

### الإشعارات (WebSocket + REST)
- `GET  /notifications`
- `PATCH /notifications/:id/read`
- WS event: `notification.new`

### Admin (تحت `/admin`، يتطلب role=admin)
- `GET  /admin/users` — قائمة + بحث + فلتر
- `PATCH /admin/users/:id/status`
- `POST /admin/users/:id/balance` — تعديل رصيد (Ledger)
- `GET  /admin/kyc?status=pending`
- `PATCH /admin/kyc/:id` — موافقة/رفض
- `GET  /admin/transactions`
- `GET  /admin/deposits` / `PATCH /admin/deposits/:id`
- `GET  /admin/withdrawals` / `PATCH /admin/withdrawals/:id`
- `CRUD /admin/plans`
- `CRUD /admin/agents`
- `GET/PUT /admin/config` — سعر الصرف، الرسوم، أرقام التواصل، معلومات البنك
- `CRUD /admin/admins` — إضافة/حذف/تغيير كلمة سر مدير
- `POST /admin/notifications/broadcast`
- `GET  /admin/reports/overview` — KPIs
- `GET  /admin/reports/cashflow?from=&to=`
- `GET  /admin/audit-log`

ملف مفصل لكل endpoint موجود داخل `src/<module>/<module>.controller.ts`.
