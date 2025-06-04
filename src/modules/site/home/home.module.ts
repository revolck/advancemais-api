import { Module } from '@nestjs/common';
import { SobreController } from './controllers/sobre.controller';
import { BannerController } from './controllers/banner.controller';
import { ServicoController } from './controllers/servico.controller';
import { SobreService } from './services/sobre.service';
import { BannerService } from './services/banner.service';
import { ServicoService } from './services/servico.service';

/**
 * 🏠 Módulo da página inicial
 *
 * Gerencia conteúdos da home:
 * - Seção sobre
 * - Banners
 * - Serviços oferecidos
 */
@Module({
  controllers: [SobreController, BannerController, ServicoController],
  providers: [SobreService, BannerService, ServicoService],
  exports: [SobreService, BannerService, ServicoService],
})
export class HomeModule {}
