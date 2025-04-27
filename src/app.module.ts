// src/app.module.ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService], // Exporta para ser usado por outros módulos
})
export class AppModule {}
