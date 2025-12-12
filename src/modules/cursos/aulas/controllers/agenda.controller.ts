import { Request, Response } from 'express';
import { agendaService } from '../services/agenda.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const agendaQuerySchema = z.object({
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  tipos: z.string().optional(), // AULA,PROVA,ANIVERSARIO,TURMA (CSV)
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
}
