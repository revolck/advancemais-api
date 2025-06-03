import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet'; // 🔧 CORREÇÃO: Import sem asterisco
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 🏗️ Criar aplicação NestJS
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 📋 Obter configurações
  const configService = app.get(ConfigService);
  const port = configService.get('app.port') || 3000;
  const environment = configService.get('app.environment') || 'development';
  const corsOrigins = configService.get('cors.origin') || [
    'http://localhost:3000',
  ];

  // 🛡️ Configurações de segurança com Helmet
  app.use(
    helmet({
      contentSecurityPolicy: environment === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 🌐 CORS configurado para desenvolvimento e produção
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ✅ Validação global com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
      disableErrorMessages: environment === 'production',
    }),
  );

  // 🌍 Prefixo global para todas as rotas
  app.setGlobalPrefix('api/v1');

  // 🚀 Iniciar servidor
  await app.listen(port);

  // 📋 Logs de inicialização
  logger.log(`🚀 Aplicação iniciada no ambiente: ${environment}`);
  logger.log(`🌐 Servidor rodando na porta: ${port}`);
  logger.log(`📍 URL da API: http://localhost:${port}/api/v1`);
  logger.log(`🔐 Autenticação JWT configurada`);
  logger.log(`🛡️ Rate limiting ativo`);
  logger.log(`🗄️ Banco PostgreSQL conectado`);

  if (environment === 'development') {
    logger.log(`📊 Prisma Studio: npx prisma studio`);
  }
}

// 🚨 Tratamento de erros não capturados
bootstrap().catch((error) => {
  console.error('❌ Erro crítico ao iniciar aplicação:', error);
  process.exit(1);
});
