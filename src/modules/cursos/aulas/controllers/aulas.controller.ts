import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { aulasService } from '../services/aulas.service';
import {
  createAulaSchema,
  updateAulaSchema,
  listAulasQuerySchema,
  updateProgressoSchema,
  registrarPresencaSchema,
} from '../validators/aulas.schema';
import { logger } from '@/utils/logger';

export class AulasController {
  /**
   * GET /api/v1/cursos/aulas
   * Listar aulas com filtros
   */
  static list = async (req: Request, res: Response) => {
    try {
      const query = listAulasQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;

      const result = await aulasService.list(query, usuarioLogado);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error('[AULAS_LIST_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'AULAS_LIST_ERROR',
        message: error?.message || 'Erro ao listar aulas',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id
   * Buscar aula por ID
   */
  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const aula = await aulasService.getById(id, usuarioLogado);

      res.json({
        success: true,
        aula,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        code: 'AULA_NOT_FOUND',
        message: error?.message || 'Aula não encontrada',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas
   * Criar nova aula
   */
  static create = async (req: Request, res: Response) => {
    try {
      const payload = createAulaSchema.parse(req.body);
      const usuarioLogado = req.user!;

      const aula = await aulasService.create(payload, usuarioLogado);

      res.status(201).json({
        success: true,
        aula,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error('[AULAS_CREATE_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'AULAS_CREATE_ERROR',
        message: error?.message || 'Erro ao criar aula',
      });
    }
  };

  /**
   * PUT /api/v1/cursos/aulas/:id
   * Atualizar aula
   */
  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateAulaSchema.parse(req.body);
      const usuarioLogado = req.user!;

      const aula = await aulasService.update(id, payload, usuarioLogado);

      res.json({
        success: true,
        aula,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULAS_UPDATE_ERROR',
        message: error?.message || 'Erro ao atualizar aula',
      });
    }
  };

  /**
   * DELETE /api/v1/cursos/aulas/:id
   * Soft delete de aula
   */
  static delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const result = await aulasService.delete(id, usuarioLogado);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'AULAS_DELETE_ERROR',
        message: error?.message || 'Erro ao remover aula',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas/:id/progresso
   * Atualizar progresso do aluno
   */
  static updateProgresso = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateProgressoSchema.parse(req.body);
      const alunoId = req.user!.id;

      const progresso = await aulasService.updateProgresso(id, payload, alunoId);

      res.json({
        success: true,
        progresso: {
          percentualAssistido: Number(progresso.percentualAssistido),
          concluida: progresso.concluida,
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROGRESSO_ERROR',
        message: error?.message || 'Erro ao atualizar progresso',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas/:id/presenca
   * Registrar entrada/saída em aula ao vivo
   */
  static registrarPresenca = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = registrarPresencaSchema.parse(req.body);
      const usuarioId = req.user!.id;

      const result = await aulasService.registrarPresenca(
        id,
        payload.tipo,
        payload.inscricaoId,
        usuarioId,
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'PRESENCA_ERROR',
        message: error?.message || 'Erro ao registrar presença',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/historico
   * Buscar histórico de alterações
   */
  static getHistorico = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const historico = await aulasService.getHistorico(id, usuarioLogado);

      res.json({
        success: true,
        historico,
      });
    } catch (error: any) {
      res.status(403).json({
        success: false,
        code: 'HISTORICO_ERROR',
        message: error?.message || 'Erro ao buscar histórico',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/progresso
   * Buscar progresso da aula
   */
  static getProgresso = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { alunoId } = req.query;
      const usuarioLogado = req.user!;

      const progressos = await aulasService.getProgresso(id, usuarioLogado, alunoId as string);

      res.json({
        success: true,
        progressos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PROGRESSO_ERROR',
        message: error?.message || 'Erro ao buscar progresso',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/presenca
   * Listar presenças da aula
   */
  static getPresencas = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const presencas = await aulasService.getPresencas(id, usuarioLogado);

      res.json({
        success: true,
        presencas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PRESENCA_ERROR',
        message: error?.message || 'Erro ao buscar presenças',
      });
    }
  };
}
