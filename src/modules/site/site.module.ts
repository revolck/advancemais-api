import { Module } from '@nestjs/common';
import { HomeModule } from './home/home.module';
import { InstitucionalModule } from './institucional/institucional.module';
import { CursosModule } from './cursos/cursos.module';

/**
 * 🌐 Módulo principal do Site
 *
 * Organiza todos os módulos relacionados ao conteúdo do website:
 * - Home: página inicial (sobre, banners, serviços)
 * - Institucional: páginas sobre a empresa
 * - Cursos: página de cursos e mercado de trabalho
 */
@Module({
  imports: [HomeModule, InstitucionalModule, CursosModule],
  exports: [HomeModule, InstitucionalModule, CursosModule],
})
export class SiteModule {}
