# دليل النشر على Render — Aman Backend

## ✅ ما تم إصلاحه
- **schema.prisma**: السبب في 31 خطأ هو أن `generator` و `datasource` كانا على سطر واحد. تم إعادة تنسيقهما كبلوكات متعددة الأسطر، والآن Prisma يقول: ✅ `The schema is valid 🚀`
- **render.yaml**: ملف جاهز للنشر التلقائي على Render.

## ⚠️ تحذير أمني عاجل
كلمة سر قاعدة البيانات `Ali05352872157` تم نشرها علنًا. **غيّرها فورًا** من Supabase:
`Project Settings → Database → Reset database password`

---

## خطوات النشر على Render (خطوة بخطوة)

### 1) ارفع الكود إلى GitHub
1. أنشئ Repository جديد على https://github.com (مثلاً `aman-backend`).
2. على جهازك:
   ```bash
   cd aman-backend-fixed
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/USERNAME/aman-backend.git
   git push -u origin main
   ```

### 2) أنشئ خدمة على Render
1. سجّل الدخول على https://render.com → **New + → Blueprint**.
2. اربط حساب GitHub واختر الريبو `aman-backend`.
3. Render سيقرأ `render.yaml` تلقائيًا وينشئ خدمة `aman-backend`.

### 3) أضف متغيرات البيئة (Environment)
في صفحة الخدمة → **Environment** أضف القيم التي ليست `generateValue`:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:NEW_PASSWORD@db.dogwttptvwvxjsevxris.supabase.co:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=1` |
| `BOOTSTRAP_ADMIN_PASSWORD` | اختر كلمة قوية |

> 💡 إذا واجهت مشكلة اتصال مع Supabase، استخدم رابط **Connection Pooler** (المنفذ 6543) بدل 5432:
> `postgresql://postgres.dogwttptvwvxjsevxris:NEW_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

### 4) Deploy
- اضغط **Manual Deploy → Deploy latest commit**.
- أول build يستغرق ~5 دقائق (npm install + prisma generate + nest build).
- عند نجاحه ستجد الخدمة على: `https://aman-backend.onrender.com`
- وثائق Swagger على: `https://aman-backend.onrender.com/docs`

### 5) ربط دومين خاص (اختياري)
في الخدمة → **Settings → Custom Domains → Add Custom Domain**
ثم أضف عند مزود الدومين سجل **CNAME** يشير إلى `aman-backend.onrender.com`.

---

## ملاحظات
- خطة Free تنام بعد 15 دقيقة خمول (cold start ~30s). للإنتاج استخدم خطة **Starter $7/mo**.
- Redis: لم أضفه في `render.yaml`. إذا كان الكود يحتاجه، أنشئ **New + → Key Value (Redis)** على Render وانسخ `REDIS_URL` إلى متغيرات البيئة.
- أول تشغيل سينفذ `prisma migrate deploy` تلقائيًا. تأكد أن مجلد `prisma/migrations` موجود في الريبو، وإلا استخدم `npx prisma db push` بدلاً منه في `startCommand`.
