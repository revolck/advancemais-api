import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// 📋 Configurações
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';

// 🗄️ Módulos principais
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { SiteModule } from './modules/site/site.module';

// 🛡️ Guards, Filters e Interceptors
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// 🎮 Controllers e Services básicos
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 🌐 Configuração global do environment
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),

    // 🛡️ Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 10, // 10 requests por segundo
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutos
        limit: 1000, // 1000 requests por 15 minutos
      },
    ]),

    // 📦 Módulos da aplicação
    DatabaseModule,
    AuthModule,
    SiteModule,
    UsuariosModule,

    // 🔮 Módulos futuros
    // UsuariosModule,
    // AuditoriaModule,
    // MercadoPagoModule,
    // BrevoModule,
    // GoogleMeetModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // 🛡️ Guards globais
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // 🔍 Filtros globais
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // 📊 Interceptors globais
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
