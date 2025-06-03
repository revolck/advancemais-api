import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
      errorFormat: 'colorless',
    });
  }

  /**
   * 🚀 Conecta ao banco MySQL na inicialização do módulo
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Conexão com MySQL estabelecida com sucesso');

      // Testar conexão
      await this.$queryRaw`SELECT 1`;
      this.logger.log('🗄️ Banco de dados MySQL funcionando corretamente');
    } catch (error) {
      this.logger.error('❌ Erro ao conectar com MySQL:', error);
      throw error;
    }
  }

  /**
   * 🔌 Desconecta do banco na destruição do módulo
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('🔌 Conexão com MySQL encerrada');
    } catch (error) {
      this.logger.error('❌ Erro ao desconectar do MySQL:', error);
    }
  }

  /**
   * 🧪 Método para testar conexão
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('❌ Teste de conexão falhou:', error);
      return false;
    }
  }
}
