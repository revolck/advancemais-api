import { Module } from '@nestjs/common';
import { TituloPaginaCursosController } from './controllers/titulo-pagina-cursos.controller';
import { MercadoTrabalhoController } from './controllers/mercado-trabalho.controller';
import { TituloPaginaCursosService } from './services/titulo-pagina-cursos.service';
import { MercadoTrabalhoService } from './services/mercado-trabalho.service';

/**
 * 📚 Módulo de Cursos
 *
 * Gerencia conteúdos da página de cursos:
 * - Títulos da página de cursos
 * - Mercado de trabalho e destaques
 */
@Module({
  controllers: [TituloPaginaCursosController, MercadoTrabalhoController],
  providers: [TituloPaginaCursosService, MercadoTrabalhoService],
  exports: [TituloPaginaCursosService, MercadoTrabalhoService],
})
export class CursosModule {}
