import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { estagiosService } from '../services/estagios.service';
import {
  confirmarEstagioSchema,
  createEstagioSchema,
  listEstagiosQuerySchema,
  reenviarConfirmacaoSchema,
  updateEstagioSchema,
  updateEstagioStatusSchema,
} from '../validators/estagios.schema';

const parseCursoId = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  // Cursos.id agora é UUID (String), não mais Int
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value.trim())) {
    return null;
  }
  return value.trim();
};

const parseUuid = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value;
};

export class EstagiosController {
  static async list(req: Request, res: Response) {
    try {
      const query = listEstagiosQuerySchema.parse(req.query);
      const result = await estagiosService.list(query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de estágios',
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

      return res.status(500).json({
        success: false,
        code: 'ESTAGIOS_LIST_ERROR',
        message: 'Erro ao listar estágios',
        error: error?.message,
      });
    }
  }

  static async create(req: Request, res: Response) {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!cursoId || !turmaId || !inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos para criação de estágio',
      });
    }

    try {
      const payload = createEstagioSchema.parse(req.body);
      const usuarioId = req.user?.id;

      const estagio = await estagiosService.create(
        cursoId,
        turmaId,
        inscricaoId,
        payload,
        usuarioId,
      );

      return res.status(201).json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação de estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: 'Turma ou inscrição não encontrada para o curso informado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CREATE_ERROR',
        message: 'Erro ao criar estágio para a inscrição informada',
        error: error?.message,
      });
    }
  }

  static async listByInscricao(req: Request, res: Response) {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!cursoId || !turmaId || !inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para listagem de estágios',
      });
    }

    try {
      const estagios = await estagiosService.listByInscricao(cursoId, turmaId, inscricaoId);
      return res.json({ data: estagios });
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: 'Turma ou inscrição não encontrada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_LIST_ERROR',
        message: 'Erro ao listar estágios da inscrição',
        error: error?.message,
      });
    }
  }

  static async listMe(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    try {
      const estagios = await estagiosService.listForAluno(inscricaoId, usuarioId);
      return res.json({ data: estagios });
    } catch (error: any) {
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Inscrição não encontrada para o usuário autenticado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_LIST_ERROR',
        message: 'Erro ao listar estágios do aluno',
        error: error?.message,
      });
    }
  }

  static async get(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const estagio = await estagiosService.getById(estagioId, req.user?.id, { allowAdmin: true });
      return res.json(estagio);
    } catch (error: any) {
      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Usuário sem permissão para acessar este estágio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_GET_ERROR',
        message: 'Erro ao buscar estágio',
        error: error?.message,
      });
    }
  }

  static async update(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = updateEstagioSchema.parse(req.body);
      const usuarioId = req.user?.id;
      const estagio = await estagiosService.update(estagioId, payload, usuarioId);
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_UPDATE_ERROR',
        message: 'Erro ao atualizar estágio',
        error: error?.message,
      });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = updateEstagioStatusSchema.parse(req.body);
      const usuarioId = req.user?.id;
      const estagio = await estagiosService.updateStatus(estagioId, payload, usuarioId);
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização de status',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_STATUS_ERROR',
        message: 'Erro ao atualizar status do estágio',
        error: error?.message,
      });
    }
  }

  static async reenviarConfirmacao(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = reenviarConfirmacaoSchema.parse(req.body ?? {});
      const usuarioId = req.user?.id;
      const estagio = await estagiosService.reenviarConfirmacao(
        estagioId,
        usuarioId,
        payload.destinatarioAlternativo,
      );
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para reenvio de confirmação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado para reenvio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_REENVIAR_ERROR',
        message: 'Erro ao reenviar confirmação do estágio',
        error: error?.message,
      });
    }
  }

  static async confirmar(req: Request, res: Response) {
    const token = parseUuid(req.params.token);

    if (!token) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Token de confirmação inválido',
      });
    }

    try {
      const payload = confirmarEstagioSchema.parse(req.body ?? {});
      const estagio = await estagiosService.confirmar(token, {
        ...payload,
        ip: payload.ip ?? req.ip,
        userAgent: req.headers['user-agent']?.toString(),
      });
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para confirmação do estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CONFIRMACAO_INVALIDA') {
        return res.status(404).json({
          success: false,
          code: 'CONFIRMACAO_INVALIDA',
          message: 'Confirmação de estágio inválida ou já utilizada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CONFIRM_ERROR',
        message: 'Erro ao confirmar ciência do estágio',
        error: error?.message,
      });
    }
  }
}
