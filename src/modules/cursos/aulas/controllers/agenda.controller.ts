import { Request, Response } from 'express';
import { agendaService } from '../services/agenda.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const parseBooleanQueryParam = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
};

const agendaQuerySchema = z.object({
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  tipos: z.string().optional(), // AULA,PROVA,ANIVERSARIO,TURMA (CSV)
});

const agendaAniversariantesQuerySchema = z
  .object({
    dataInicio: z.coerce.date(),
    dataFim: z.coerce.date(),
    roles: z.string().optional(),
    incluirInativos: z.preprocess(parseBooleanQueryParam, z.boolean().optional()).default(false),
  })
  .refine((value) => value.dataInicio <= value.dataFim, {
    message: 'dataInicio deve ser menor ou igual a dataFim',
    path: ['dataInicio'],
  });

export class AgendaController {
  /**
   * GET /api/v1/cursos/agenda
   * Buscar eventos da agenda
   */
  static getEventos = async (req: Request, res: Response) => {
    try {
      const query = agendaQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;

      const tipos = query.tipos?.split(',');

      const result = await agendaService.getEventos({
        usuarioId: usuarioLogado.id,
        role: usuarioLogado.role,
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
        tipos,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[AGENDA_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'AGENDA_ERROR',
        message: error?.message || 'Erro ao buscar agenda',
      });
    }
  };

  /**
   * GET /api/v1/cursos/agenda/aniversariantes
   * Buscar aniversariantes internos no intervalo informado
   */
  static getAniversariantes = async (req: Request, res: Response) => {
    try {
      const query = agendaAniversariantesQuerySchema.parse(req.query);
      const roles = query.roles
        ?.split(',')
        .map((role) => role.trim())
        .filter(Boolean);

      const result = await agendaService.getAniversariantes({
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
        roles,
        incluirInativos: query.incluirInativos,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para consulta de aniversariantes',
          errors: error.flatten(),
        });
      }

      logger.error('[AGENDA_ANIVERSARIANTES_ERROR]', { error: error?.message });
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Erro ao buscar aniversariantes da agenda',
      });
    }
  };
}
