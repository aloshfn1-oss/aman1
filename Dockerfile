# استخدام نسخة Node مستقرة تعتمد على Alpine
FROM node:20-alpine

# تثبيت المكتبات الضرورية لمحرك Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# نسخ ملفات الإعدادات وتثبيت المكتبات
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# نسخ بقية ملفات المشروع وبناء الكود
COPY . .
RUN npx prisma generate
RUN npm run build

# كود NestJS عندك مبرمج على المنفذ 3000 أو 10000
EXPOSE 3000

# أمر التشغيل النهائي (يتضمن تحديث قاعدة البيانات وتشغيل السيرفر)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
