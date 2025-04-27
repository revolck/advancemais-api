// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Você pode incluir opções de configuração aqui
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  // Conecta ao inicializar o módulo
  async onModuleInit() {
    await this.$connect();
  }

  // Desconecta ao destruir o módulo
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
