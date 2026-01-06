import { Roles } from '@prisma/client';
import { recrutadorEmpresasService } from './recrutador-empresas.service';

export type EmpresaScope = { mode: 'GLOBAL' } | { mode: 'EMPRESAS'; empresaUsuarioIds: string[] };

export const empresaAccessService = {
  /**
   * Retorna o escopo de empresas que o viewer pode acessar.
   * - ADMIN/MODERADOR/SETOR_DE_VAGAS: GLOBAL
   * - EMPRESA: apenas a própria (viewerId)
   * - RECRUTADOR: empresas vinculadas em UsuariosEmpresasVinculos
   */
  getEmpresaScope: async (params: {
    viewerId: string;
    viewerRole: Roles;
  }): Promise<EmpresaScope> => {
    if (
      params.viewerRole === Roles.ADMIN ||
      params.viewerRole === Roles.MODERADOR ||
      params.viewerRole === Roles.SETOR_DE_VAGAS
    ) {
      return { mode: 'GLOBAL' };
    }

    if (params.viewerRole === Roles.EMPRESA) {
      return { mode: 'EMPRESAS', empresaUsuarioIds: [params.viewerId] };
    }

    if (params.viewerRole === Roles.RECRUTADOR) {
      const empresaUsuarioIds = await recrutadorEmpresasService.listEmpresaUsuarioIds(
        params.viewerId,
      );
      return { mode: 'EMPRESAS', empresaUsuarioIds };
    }

    return { mode: 'EMPRESAS', empresaUsuarioIds: [] };
  },
};
