import { Request, Response } from 'express';
import { CursosAgendaTipo } from '@prisma/client';
import { ZodError } from 'zod';

import { agendaService } from '../services/agenda.service';
import { createAgendaSchema, updateAgendaSchema } from '../validators/agenda.schema';

const parseCursoId = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  // Cursos.id agora é UUID (String), não mais Int
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw.trim())) {
    return null;
  }
  return raw.trim();
};

const parseTurmaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseAgendaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseAgendaTipo = (raw: unknown): CursosAgendaTipo | undefined | null => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.toUpperCase();
  const allowed = Object.values(CursosAgendaTipo);
  return allowed.includes(normalized as CursosAgendaTipo) ? (normalized as CursosAgendaTipo) : null;
};

const parseDateQuery = (raw: unknown) => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const parseBooleanQuery = (raw: unknown): boolean | undefined | null => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw === 'boolean') {
    return raw;
  }

  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const parseTurmaQuery = (raw: unknown) => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
};

export class AgendaController {
  static list = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    const tipo = parseAgendaTipo(req.query.tipo);
    if (tipo === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Tipo de evento inválido',
      });
    }

    const dataInicio = parseDateQuery(req.query.dataInicio);
    const dataFim = parseDateQuery(req.query.dataFim);
    const apenasFuturos = parseBooleanQuery(req.query.apenasFuturos);

    if (dataInicio === null || dataFim === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Período informado é inválido',
      });
    }

    if (apenasFuturos === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetro apenasFuturos inválido',
      });
    }

    try {
      const eventos = await agendaService.list(cursoId, turmaId, {
        tipo: tipo ?? undefined,
        dataInicio,
        dataFim,
        apenasFuturos: apenasFuturos ?? undefined,
      });

      res.json({ data: eventos });
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_LIST_ERROR',
        message: 'Erro ao listar eventos da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const agendaId = parseAgendaId(req.params.agendaId);

    if (!cursoId || !turmaId || !agendaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou evento inválidos',
      });
    }

    try {
      const evento = await agendaService.get(cursoId, turmaId, agendaId);
      res.json(evento);
    } catch (error: any) {
      if (error?.code === 'AGENDA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AGENDA_NOT_FOUND',
          message: 'Evento não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_GET_ERROR',
        message: 'Erro ao buscar evento da turma',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const data = createAgendaSchema.parse(req.body);
      const evento = await agendaService.create(cursoId, turmaId, data);
      res.status(201).json(evento);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do evento',
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

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_CREATE_ERROR',
        message: 'Erro ao criar evento para a turma',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const agendaId = parseAgendaId(req.params.agendaId);

    if (!cursoId || !turmaId || !agendaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou evento inválidos',
      });
    }

    try {
      const data = updateAgendaSchema.parse(req.body);

      if (Object.values(data).every((value) => value === undefined)) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do evento',
        });
      }

      const evento = await agendaService.update(cursoId, turmaId, agendaId, data);
      res.json(evento);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do evento',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AGENDA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AGENDA_NOT_FOUND',
          message: 'Evento não encontrado para a turma informada',
        });
      }

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_UPDATE_ERROR',
        message: 'Erro ao atualizar evento da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const agendaId = parseAgendaId(req.params.agendaId);

    if (!cursoId || !turmaId || !agendaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou evento inválidos',
      });
    }

    try {
      await agendaService.delete(cursoId, turmaId, agendaId);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'AGENDA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AGENDA_NOT_FOUND',
          message: 'Evento não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_DELETE_ERROR',
        message: 'Erro ao remover evento da turma',
        error: error?.message,
      });
    }
  };

  static listMy = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    const tipo = parseAgendaTipo(req.query.tipo);
    if (tipo === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Tipo de evento inválido',
      });
    }

    const dataInicio = parseDateQuery(req.query.dataInicio);
    const dataFim = parseDateQuery(req.query.dataFim);
    const apenasFuturos = parseBooleanQuery(req.query.apenasFuturos);
    const turmaId = parseTurmaQuery(req.query.turmaId);

    if (dataInicio === null || dataFim === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Período informado é inválido',
      });
    }

    if (apenasFuturos === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetro apenasFuturos inválido',
      });
    }

    if (turmaId === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da turma inválido',
      });
    }

    try {
      const eventos = await agendaService.listMy(userId, {
        tipo: tipo ?? undefined,
        dataInicio,
        dataFim,
        apenasFuturos: apenasFuturos ?? undefined,
        turmaId,
      });

      res.json({ data: eventos });
    } catch (error: any) {
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Você não está inscrito na turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AGENDA_MY_LIST_ERROR',
        message: 'Erro ao listar eventos do aluno',
        error: error?.message,
      });
    }
  };
}
