import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const alertasLogger = logger.child({ module: 'TurmaAlertasController' });

export class TurmaAlertasController {
  /**
   * GET /api/v1/cursos/turmas/:turmaId/alertas/:token
   * Detalhe de um alerta de frequência (token válido por 7 dias a partir da criação).
   */
  static get = async (req: Request, res: Response) => {
    try {
      const { turmaId, token } = req.params;
      const usuarioLogado = req.user!;

      const alerta = await prisma.cursosTurmasAlertas.findUnique({
        where: { token },
        include: {
          CursosTurmas: {
            select: {
              id: true,
              nome: true,
              instrutorId: true,
              CursosTurmasInstrutores: { select: { instrutorId: true } },
              Cursos: { select: { id: true, nome: true } },
            },
          },
        },
      });

      if (!alerta || alerta.turmaId !== turmaId || alerta.expiraEm <= new Date()) {
        return res.status(404).json({
          success: false,
          code: 'ALERTA_NOT_FOUND',
          message: 'Alerta não encontrado ou expirado',
        });
      }

      if (usuarioLogado.role === Roles.INSTRUTOR) {
        const vinculado =
          alerta.CursosTurmas.instrutorId === usuarioLogado.id ||
          alerta.CursosTurmas.CursosTurmasInstrutores.some(
            (vinculo) => vinculo.instrutorId === usuarioLogado.id,
          );

        if (!vinculado) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Sem permissão para acessar este alerta',
          });
        }
      }

      res.json({
        success: true,
        alerta: {
          id: alerta.id,
          checkpoint: alerta.checkpoint,
          criadoEm: alerta.criadoEm.toISOString(),
          expiraEm: alerta.expiraEm.toISOString(),
          alunosAfetados: alerta.alunosAfetados,
          turma: { id: alerta.CursosTurmas.id, nome: alerta.CursosTurmas.nome },
          curso: { id: alerta.CursosTurmas.Cursos.id, nome: alerta.CursosTurmas.Cursos.nome },
        },
      });
    } catch (error: any) {
      alertasLogger.error('[TURMA_ALERTA_GET_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'TURMA_ALERTA_GET_ERROR',
        message: 'Erro ao buscar alerta',
      });
    }
  };
}
