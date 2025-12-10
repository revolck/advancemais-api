import { Request, Response } from 'express';
import type { StatusDeVagas } from '@prisma/client';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { minhasVagasService } from '@/modules/empresas/vagas/services/minhas-vagas.service';

/**
 * Controller para empresa acessar suas próprias vagas
 * Não requer empresaId na URL, usa o token JWT para identificar a empresa
 */
export class MinhasVagasController {
  /**
   * GET /api/v1/empresas/vagas/minhas
   * Lista vagas da empresa autenticada
   */
  static list = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;

      // Apenas empresas podem acessar este endpoint
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message:
            'Este endpoint é exclusivo para empresas. Admins devem usar /api/v1/admin/empresas/{id}/vagas',
        });
      }

      const { status, page, pageSize } = req.query as {
        status?: string | string[];
        page?: string;
        pageSize?: string;
      };

      const validStatuses = new Set<StatusDeVagas>([
        'RASCUNHO',
        'EM_ANALISE',
        'PUBLICADO',
        'EXPIRADO',
        'DESPUBLICADA',
        'PAUSADA',
        'ENCERRADA',
      ] as const);

      let statusesFilter: StatusDeVagas[] | undefined = undefined;

      // Normaliza status para array
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        const allStatuses = statusArray.flatMap((s) => {
          if (typeof s !== 'string') return [];
          return s.split(',').map((val) => val.trim().toUpperCase());
        });

        // Suporta ALL/TODAS/TODOS para trazer todos os status
        if (allStatuses.some((s) => ['ALL', 'TODAS', 'TODOS'].includes(s.toUpperCase()))) {
          statusesFilter = Array.from(validStatuses) as StatusDeVagas[];
        } else {
          statusesFilter = allStatuses.filter((s) =>
            validStatuses.has(s as StatusDeVagas),
          ) as StatusDeVagas[];
        }
      }

      // Buscar vagas da empresa com último candidato (sempre usa o usuarioId do token)
      const vagas = await minhasVagasService.listar({
        empresaId: usuarioId, // Usa o usuarioId do token JWT
        status: statusesFilter,
        page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
        pageSize: pageSize ? Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10)) : undefined,
      });

      res.json({
        success: true,
        data: vagas,
        pagination: {
          page: page ? parseInt(page, 10) : 1,
          pageSize: pageSize ? parseInt(pageSize, 10) : vagas.length,
          total: vagas.length,
        },
      });
    } catch (error: any) {
      console.error('[MinhasVagasController.list] Erro:', error);
      res.status(500).json({
        success: false,
        code: 'MINHAS_VAGAS_LIST_ERROR',
        message: 'Erro ao listar suas vagas',
        error: error?.message,
      });
    }
  };
}
