import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { materiaisService } from '../services/materiais.service';
import {
  createMaterialSchema,
  updateMaterialSchema,
  reordenarMateriaisSchema,
} from '../validators/materiais.schema';
import { logger } from '@/utils/logger';

export class MateriaisController {
  /**
   * POST /api/v1/cursos/aulas/:aulaId/materiais
   * Criar material (via URL do blob)
   */
  static create = async (req: Request, res: Response) => {
    try {
      const { aulaId } = req.params;
      const payload = createMaterialSchema.parse(req.body);
      const usuarioId = req.user!.id;

      const material = await materiaisService.create(aulaId, payload, usuarioId);

      res.status(201).json({
        success: true,
        material,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error('[MATERIAIS_CREATE_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'MATERIAIS_CREATE_ERROR',
        message: error?.message || 'Erro ao criar material',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:aulaId/materiais
   * Listar materiais da aula
   */
  static list = async (req: Request, res: Response) => {
    try {
      const { aulaId } = req.params;

      const result = await materiaisService.list(aulaId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'MATERIAIS_LIST_ERROR',
        message: error?.message || 'Erro ao listar materiais',
      });
    }
  };

  /**
   * PUT /api/v1/cursos/aulas/:aulaId/materiais/:materialId
   * Atualizar material
   */
  static update = async (req: Request, res: Response) => {
    try {
      const { aulaId, materialId } = req.params;
      const payload = updateMaterialSchema.parse(req.body);
      const usuarioId = req.user!.id;

      const material = await materiaisService.update(aulaId, materialId, payload, usuarioId);

      res.json({
        success: true,
        material,
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
        code: 'MATERIAIS_UPDATE_ERROR',
        message: error?.message || 'Erro ao atualizar material',
      });
    }
  };

  /**
   * DELETE /api/v1/cursos/aulas/:aulaId/materiais/:materialId
   * Deletar material
   */
  static delete = async (req: Request, res: Response) => {
    try {
      const { aulaId, materialId } = req.params;
      const usuarioId = req.user!.id;

      const result = await materiaisService.delete(aulaId, materialId, usuarioId);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'MATERIAIS_DELETE_ERROR',
        message: error?.message || 'Erro ao deletar material',
      });
    }
  };

  /**
   * PATCH /api/v1/cursos/aulas/:aulaId/materiais/reordenar
   * Reordenar materiais
   */
  static reordenar = async (req: Request, res: Response) => {
    try {
      const { aulaId } = req.params;
      const payload = reordenarMateriaisSchema.parse(req.body);
      const usuarioId = req.user!.id;

      const result = await materiaisService.reordenar(aulaId, payload, usuarioId);

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
        code: 'MATERIAIS_REORDENAR_ERROR',
        message: error?.message || 'Erro ao reordenar materiais',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas/:aulaId/materiais/:materialId/gerar-token
   * Gerar token de download
   */
  static gerarToken = async (req: Request, res: Response) => {
    try {
      const { aulaId, materialId } = req.params;

      const result = await materiaisService.gerarTokenDownload(aulaId, materialId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        code: 'TOKEN_ERROR',
        message: error?.message || 'Erro ao gerar token',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/materiais/download/:token
   * Download protegido
   */
  static download = async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const usuarioId = req.user!.id;
      const usuarioRole = req.user!.role;

      const arquivoUrl = await materiaisService.downloadArquivo(token, usuarioId, usuarioRole);

      // Redirecionar para o blob storage (Supabase retorna URL pública)
      res.redirect(arquivoUrl);
    } catch (error: any) {
      res.status(403).json({
        success: false,
        code: 'DOWNLOAD_ERROR',
        message: error?.message || 'Sem acesso a este material',
      });
    }
  };
}
