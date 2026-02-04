import { Request, Response } from 'express';
import { candidatoCursosService } from './services';
import { logger } from '@/utils/logger';
import { CursosMetodos } from '@prisma/client';

const cursosControllerLogger = logger.child({ module: 'CandidatoCursosController' });

export const CandidatoCursosController = {
  listCursos: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    try {
      // Parsear query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const modalidadeParam = (req.query.modalidade as string) || 'TODOS';

      // Validar modalidade - passar como string, o service fará o mapeamento
      let modalidade: string = 'TODOS';
      if (modalidadeParam && modalidadeParam !== 'TODOS') {
        modalidade = modalidadeParam.toUpperCase();
      }

      // Validar paginação
      if (page < 1) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PAGE',
          message: 'Página deve ser maior que 0',
        });
      }

      if (limit < 1 || limit > 50) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LIMIT',
          message: 'Limit deve estar entre 1 e 50',
        });
      }

      const result = await candidatoCursosService.listCursos(usuarioId, {
        modalidade,
        page,
        limit,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      cursosControllerLogger.error({ error, usuarioId }, 'Erro ao buscar cursos do candidato');
      return res.status(500).json({
        success: false,
        code: 'CURSOS_ERROR',
        message: 'Erro ao carregar cursos',
      });
    }
  },
};
