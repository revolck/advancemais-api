import { Module } from '@nestjs/common';
import { TituloPaginaController } from './controllers/titulo-pagina.controller';
import { InformacaoAdvanceController } from './controllers/informacao-advance.controller';
import { PorqueEscolherAdvanceController } from './controllers/porque-escolher-advance.controller';
import { EmpresaController } from './controllers/empresa.controller';
import { TituloPaginaService } from './services/titulo-pagina.service';
import { InformacaoAdvanceService } from './services/informacao-advance.service';
import { PorqueEscolherAdvanceService } from './services/porque-escolher-advance.service';
import { EmpresaService } from './services/empresa.service';

/**
 * 🏢 Módulo Institucional
 *
 * Gerencia conteúdos das páginas institucionais:
 * - Títulos de páginas
 * - Informações da Advance
 * - Por que escolher a Advance
 * - Informações da empresa
 */
@Module({
  controllers: [
    TituloPaginaController,
    InformacaoAdvanceController,
    PorqueEscolherAdvanceController,
    EmpresaController,
  ],
  providers: [
    TituloPaginaService,
    InformacaoAdvanceService,
    PorqueEscolherAdvanceService,
    EmpresaService,
  ],
  exports: [
    TituloPaginaService,
    InformacaoAdvanceService,
    PorqueEscolherAdvanceService,
    EmpresaService,
  ],
})
export class InstitucionalModule {}
