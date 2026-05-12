import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('', { exclude: ['health'] });

  const cfg = new DocumentBuilder()
    .setTitle('Aman API')
    .setDescription('Wallet • Transfers • USDT • Gold • Investments • Admin')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 10000;
  await app.listen(port, '0.0.0.0');
  
  new Logger('Bootstrap').log(API running on port: ${port});
}
bootstrap();
