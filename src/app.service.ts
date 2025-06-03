import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private configService: ConfigService) {}

  /**
   * 💓 Retorna health check básico
   */
  getHealthCheck(): object {
    return {
      message: 'AdvancedMais API está funcionando! 🚀',
      timestamp: new Date().toISOString(),
      status: 'healthy',
    };
  }

  /**
   * 📊 Retorna status detalhado da aplicação
   */
  getStatus(): object {
    const appName = this.configService.get('app.name');
    const appVersion = this.configService.get('app.version');
    const environment = this.configService.get('app.environment');

    return {
      application: {
        name: appName,
        version: appVersion,
        environment,
      },
      server: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      features: {
        authentication: 'JWT with refresh token',
        database: 'PostgreSQL with Prisma',
        security: 'Helmet + Rate Limiting + Argon2',
        validation: 'class-validator',
        logging: 'NestJS Logger',
      },
    };
  }
}
