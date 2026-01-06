import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { prisma } from '@/config/prisma';

import { avaliacoesService } from '../services/avaliacoes.service';
import {
  clonarAvaliacaoSchema,
  createAvaliacaoSchema,
  listAvaliacoesQuerySchema,
  updateAvaliacaoSchema,
} from '../validators/avaliacoes.schema';

const parseUuid = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return raw.trim();
};

// Validação de UUID v4
const isValidUuid = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export class AvaliacoesController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = listAvaliacoesQuerySchema.parse(req.query);
      const result = await avaliacoesService.list(query);
      res.json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de avaliações',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACOES_LIST_ERROR',
        message: 'Erro ao listar avaliações',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const avaliacao = await avaliacoesService.get(id);
      res.json({ success: true, avaliacao });
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_GET_ERROR',
        message: 'Erro ao buscar avaliação',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const payload = createAvaliacaoSchema.parse(req.body);
      const userId = req.user?.id as string;
      const userRole = req.user?.role as string;

      // Se for INSTRUTOR, forçar instrutorId = userId
      if (userRole === 'INSTRUTOR') {
        payload.instrutorId = userId;

        // Validar que a turma (se fornecida) pertence ao instrutor
        if (payload.turmaId) {
          const turma = await prisma.cursosTurmas.findFirst({
            where: { id: payload.turmaId, instrutorId: userId },
          });

          if (!turma) {
            return res.status(403).json({
              success: false,
              code: 'INSTRUTOR_TURMA_NAO_VINCULADA',
              message: 'Você não está vinculado a esta turma',
            });
          }
        }
      }

      const avaliacao = await avaliacoesService.create(payload);
      res.status(201).json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }
      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada',
        });
      }
      if (error?.code === 'TURMA_NOT_BELONGS_TO_CURSO') {
        return res.status(400).json({
          success: false,
          code: 'TURMA_NOT_BELONGS_TO_CURSO',
          message: 'A turma selecionada não pertence ao curso informado',
        });
      }
      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado ou não é um instrutor válido',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_CREATE_ERROR',
        message: 'Erro ao criar avaliação',
        error: error?.message,
      });
    }
  };

  /**
   * Lista turmas disponíveis para seleção no formulário
   * GET /api/v1/cursos/avaliacoes/turmas?cursoId={cursoId}
   * Suporta filtro opcional por cursoId
   */
  static listTurmas = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id as string;
      const userRole = req.user?.role as string;
      const cursoId = req.query.cursoId as string | undefined;

      // Validar cursoId se fornecido
      if (cursoId && !isValidUuid(cursoId)) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Identificador de curso inválido',
        });
      }

      const turmas = await avaliacoesService.listTurmasDisponiveis(userId, userRole, cursoId);

      res.json({
        success: true,
        turmas,
        total: turmas.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'TURMAS_LIST_ERROR',
        message: 'Erro ao listar turmas disponíveis',
        error: error?.message,
      });
    }
  };

  /**
   * Lista instrutores disponíveis para seleção no formulário
   * GET /api/v1/cursos/avaliacoes/instrutores
   */
  static listInstrutores = async (req: Request, res: Response) => {
    try {
      const instrutores = await avaliacoesService.listInstrutoresDisponiveis();

      res.json({
        success: true,
        instrutores,
        total: instrutores.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'INSTRUTORES_LIST_ERROR',
        message: 'Erro ao listar instrutores disponíveis',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const payload = updateAvaliacaoSchema.parse(req.body);
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização',
        });
      }

      const avaliacao = await avaliacoesService.update(id, payload);
      res.json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_UPDATE_ERROR',
        message: 'Erro ao atualizar avaliação',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const result = await avaliacoesService.remove(id);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_DELETE_ERROR',
        message: 'Erro ao remover avaliação',
        error: error?.message,
      });
    }
  };

  static clonarParaTurma = async (req: Request, res: Response) => {
    const cursoId = parseUuid(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const payload = clonarAvaliacaoSchema.parse(req.body);
      const avaliacao = await avaliacoesService.clonarParaTurma(cursoId, turmaId, payload);
      res.status(201).json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para clonagem',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'MODULO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação template não encontrada',
        });
      }

      if (error?.code === 'AVALIACAO_ETIQUETA_DUPLICADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_ETIQUETA_DUPLICADA',
          message: error?.message || 'Já existe uma avaliação com esta etiqueta na turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_CLONE_ERROR',
        message: 'Erro ao clonar avaliação para a turma',
        error: error?.message,
      });
    }
  };
}
