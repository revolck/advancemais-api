import { logger } from '@/utils/logger';
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { candidatoCursosService } from './services';

const cursosControllerLogger = logger.child({ module: 'CandidatoCursosController' });

const enviarAtividadeRespostaSchema = z.object({
  respostas: z
    .array(
      z.object({
        questaoId: z.string().uuid(),
        respostaTexto: z.string().max(5000).nullable().optional(),
        alternativaId: z.string().uuid().nullable().optional(),
        anexoUrl: z.string().url().max(500).nullable().optional(),
        anexoNome: z.string().max(255).nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});

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

  getTurmaEstrutura: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    const { cursoId, turmaId } = req.params;
    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMS',
        message: 'Curso e turma são obrigatórios',
      });
    }

    try {
      const result = await candidatoCursosService.getTurmaEstrutura(usuarioId, cursoId, turmaId);

      if (!result) {
        return res.status(404).json({
          success: false,
          code: 'TURMA_ESTRUTURA_NOT_FOUND',
          message: 'Estrutura da turma não encontrada para este aluno',
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      cursosControllerLogger.error(
        { error, usuarioId, cursoId, turmaId },
        'Erro ao buscar estrutura da turma do candidato',
      );
      return res.status(500).json({
        success: false,
        code: 'CURSO_ESTRUTURA_ERROR',
        message: 'Erro ao carregar estrutura do curso',
      });
    }
  },

  getAulaDetalhe: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    const { cursoId, turmaId, aulaId } = req.params;
    if (!cursoId || !turmaId || !aulaId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMS',
        message: 'Curso, turma e aula são obrigatórios',
      });
    }

    try {
      const aula = await candidatoCursosService.getAulaDetalhe(usuarioId, cursoId, turmaId, aulaId);

      if (!aula) {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para este aluno',
        });
      }

      return res.json({
        success: true,
        aula,
      });
    } catch (error: any) {
      cursosControllerLogger.error(
        { error, usuarioId, cursoId, turmaId, aulaId },
        'Erro ao buscar aula da turma do candidato',
      );
      return res.status(500).json({
        success: false,
        code: 'AULA_ERROR',
        message: 'Erro ao carregar aula',
      });
    }
  },

  getAtividadeDetalhe: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id;
    const { cursoId, turmaId, atividadeId } = req.params;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }
    if (!cursoId || !turmaId || !atividadeId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMS',
        message: 'Curso, turma e atividade são obrigatórios',
      });
    }

    try {
      const atividade = await candidatoCursosService.getAtividadeDetalhe(
        usuarioId,
        cursoId,
        turmaId,
        atividadeId,
      );
      if (!atividade) {
        return res.status(404).json({
          success: false,
          code: 'ATIVIDADE_NOT_FOUND',
          message: 'Atividade não encontrada para este aluno',
        });
      }
      return res.json({ success: true, data: atividade });
    } catch (error: any) {
      cursosControllerLogger.error(
        { error, usuarioId, cursoId, turmaId, atividadeId },
        'Erro ao buscar atividade da turma do candidato',
      );
      return res.status(500).json({
        success: false,
        code: 'ATIVIDADE_ERROR',
        message: 'Erro ao carregar atividade',
      });
    }
  },

  enviarAtividadeResposta: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id;
    const { cursoId, turmaId, atividadeId } = req.params;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }
    if (!cursoId || !turmaId || !atividadeId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMS',
        message: 'Curso, turma e atividade são obrigatórios',
      });
    }

    try {
      const input = enviarAtividadeRespostaSchema.parse(req.body);
      const atividade = await candidatoCursosService.enviarAtividadeResposta(
        usuarioId,
        cursoId,
        turmaId,
        atividadeId,
        input.respostas,
      );
      return res.json({ success: true, data: atividade });
    } catch (error: any) {
      if (error instanceof ZodError || error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error instanceof ZodError ? 'Resposta inválida' : error.message,
        });
      }
      if (error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      }
      if (
        error?.code === 'ATIVIDADE_CORRIGIDA' ||
        error?.code === 'ATIVIDADE_LIMITE_ENVIOS' ||
        error?.code === 'ATIVIDADE_EDICAO_BLOQUEADA' ||
        error?.code === 'ATIVIDADE_FORA_DO_PERIODO' ||
        error?.code === 'AVALIACAO_JA_ENVIADA'
      ) {
        return res.status(409).json({ success: false, code: error.code, message: error.message });
      }

      cursosControllerLogger.error(
        { error, usuarioId, cursoId, turmaId, atividadeId },
        'Erro ao enviar resposta da atividade do candidato',
      );
      return res.status(500).json({
        success: false,
        code: 'ATIVIDADE_RESPOSTA_ERROR',
        message: 'Erro ao enviar resposta da atividade',
      });
    }
  },
};
