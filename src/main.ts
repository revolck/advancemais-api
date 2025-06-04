import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<string>('app.port') || '3000';
  const environment = configService.get('app.environment') || 'development';
  const corsOrigins = configService.get('cors.origin') || [
    'http://localhost:3000',
  ];

  app.use(
    helmet({
      contentSecurityPolicy: environment === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 👈 Importante para funcionar @Transform
      whitelist: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
      stopAtFirstError: false, // opcional: se quiser parar na primeira validação
      disableErrorMessages: environment === 'production', // em prod, esconde mensagens detalhadas
    }),
  );

  app.setGlobalPrefix('api/v1');

  const portNumber = parseInt(port, 10);
  await app.listen(portNumber);

  logger.log(`🚀 Aplicação iniciada no ambiente: ${environment}`);
  logger.log(`🌐 Servidor rodando na porta: ${portNumber}`);
  logger.log(`📍 URL da API: http://localhost:${portNumber}/api/v1`);
  logger.log(`🔐 Autenticação JWT configurada`);
  logger.log(`🛡️ Rate limiting ativo`);
  logger.log(`🗄️ Banco PostgreSQL conectado`);

  if (environment === 'development') {
    logger.log(`📊 Prisma Studio: npx prisma studio`);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Erro crítico ao iniciar aplicação:', error);
  process.exit(1);
});
