import { Module } from '@nestjs/common';
import { UsuariosController } from './controllers/usuarios.controller';
import { PerfilController } from './controllers/perfil.controller';
import { BanimentoController } from './controllers/banimento.controller';
import { AuditoriaController } from './controllers/auditoria.controller';

import { UsuariosService } from './services/usuarios.service';
import { PerfilService } from './services/perfil.service';
import { BanimentoService } from './services/banimento.service';
import { AuditoriaService } from './services/auditoria.service';
import { ValidacaoService } from './services/validacao.service';

/**
 * 👥 Módulo de gestão de usuários
 *
 * Responsabilidades:
 * - CRUD completo de usuários
 * - Gestão de perfis complementares
 * - Sistema de banimentos
 * - Auditoria e logs
 * - Validações avançadas
 */
@Module({
  controllers: [
    UsuariosController,
    PerfilController,
    BanimentoController,
    AuditoriaController,
  ],
  providers: [
    UsuariosService,
    PerfilService,
    BanimentoService,
    AuditoriaService,
    ValidacaoService,
  ],
  exports: [
    UsuariosService,
    PerfilService,
    BanimentoService,
    AuditoriaService,
    ValidacaoService,
  ],
})
export class UsuariosModule {}
