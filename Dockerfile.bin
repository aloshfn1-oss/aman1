# استخدام نسخة Node مستقرة
FROM node:20-alpine

# تثبيت المكتبات التي يحتاجها Prisma وNestJS
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# نسخ ملفات الإعدادات
COPY package*.json ./
COPY prisma ./prisma/

# تثبيت المكتبات
RUN npm install

# نسخ بقية الكود وبناء المشروع
COPY . .
RUN npx prisma generate
RUN npm run build

# تحديد المنفذ تلقائياً
EXPOSE 3000

# أمر التشغيل النهائي
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
