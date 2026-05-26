import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { questoesService } from '../services/questoes.service';
import { pagamentosAlunoService } from '../services/pagamentos-aluno.service';
import {
  createQuestaoSchema,
  updateQuestaoSchema,
  responderQuestaoSchema,
  corrigirRespostaSchema,
} from '../validators/questoes.schema';

const parseCursoId = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
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

const parseProvaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseQuestaoId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const ensureAlunoPodeAcessarProva = async (
  req: Request,
  turmaId: string,
  provaId: string,
  inscricaoId?: string,
) => {
  if (req.user?.role !== Roles.ALUNO_CANDIDATO) return;

  const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
    where: {
      ...(inscricaoId ? { id: inscricaoId } : {}),
      alunoId: req.user.id,
      turmaId,
      statusPagamento: 'APROVADO',
    },
    select: { id: true },
  });
  if (!inscricao) {
    const error: any = new Error('Inscricao nao pertence ao aluno autenticado');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const acesso = await pagamentosAlunoService.getAcessoRecuperacao(
    req.user.id,
    inscricao.id,
    provaId,
  );
  if (acesso.requiresPayment && !acesso.liberado) {
    const error: any = new Error('Pagamento da recuperacao ainda nao aprovado');
    error.code = 'RECUPERACAO_PAGAMENTO_PENDENTE';
    throw error;
  }
};

const respondAcessoNegado = (res: Response, error: any) => {
  if (error?.code !== 'FORBIDDEN' && error?.code !== 'RECUPERACAO_PAGAMENTO_PENDENTE') {
    return false;
  }
  res.status(403).json({ success: false, code: error.code, message: error.message });
  return true;
};

export class QuestoesController {
  static list = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      await ensureAlunoPodeAcessarProva(
        req,
        turmaId,
        provaId,
        req.query.inscricaoId as string | undefined,
      );
      const questoes = await questoesService.list(cursoId, turmaId, provaId, {
        includeRespostaCorreta: req.user?.role !== Roles.ALUNO_CANDIDATO,
      });
      res.json({ data: questoes });
    } catch (error: any) {
      if (respondAcessoNegado(res, error)) return;
      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error?.code === 'PROVA_PUBLICADA_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'PROVA_PUBLICADA_LOCKED',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'QUESTOES_LIST_ERROR',
        message: 'Erro ao listar questões da prova',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = parseQuestaoId(req.params.questaoId);

    if (!cursoId || !turmaId || !provaId || !questaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos',
      });
    }

    try {
      await ensureAlunoPodeAcessarProva(
        req,
        turmaId,
        provaId,
        req.query.inscricaoId as string | undefined,
      );
      const questao = await questoesService.get(cursoId, turmaId, provaId, questaoId, {
        includeRespostaCorreta: req.user?.role !== Roles.ALUNO_CANDIDATO,
      });
      res.json(questao);
    } catch (error: any) {
      if (respondAcessoNegado(res, error)) return;
      if (error?.code === 'QUESTAO_NOT_FOUND' || error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'QUESTAO_GET_ERROR',
        message: 'Erro ao buscar questão',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      const data = createQuestaoSchema.parse(req.body);
      const questao = await questoesService.create(cursoId, turmaId, provaId, data);
      res.status(201).json(questao);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da questão',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'QUESTAO_CREATE_ERROR',
        message: 'Erro ao criar questão',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = parseQuestaoId(req.params.questaoId);

    if (!cursoId || !turmaId || !provaId || !questaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos',
      });
    }

    try {
      const data = updateQuestaoSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da questão',
        });
      }

      const questao = await questoesService.update(cursoId, turmaId, provaId, questaoId, data);
      res.json(questao);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da questão',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error?.code === 'QUESTAO_NOT_FOUND' ||
        error?.code === 'PROVA_NOT_FOUND' ||
        error?.code === 'TURMA_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error?.code === 'PROVA_PUBLICADA_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'PROVA_PUBLICADA_LOCKED',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'QUESTAO_UPDATE_ERROR',
        message: 'Erro ao atualizar questão',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = parseQuestaoId(req.params.questaoId);

    if (!cursoId || !turmaId || !provaId || !questaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos',
      });
    }

    try {
      const result = await questoesService.remove(cursoId, turmaId, provaId, questaoId);
      res.json(result);
    } catch (error: any) {
      if (
        error?.code === 'QUESTAO_NOT_FOUND' ||
        error?.code === 'PROVA_NOT_FOUND' ||
        error?.code === 'TURMA_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error?.code === 'PROVA_PUBLICADA_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'PROVA_PUBLICADA_LOCKED',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'QUESTAO_DELETE_ERROR',
        message: 'Erro ao remover questão',
        error: error?.message,
      });
    }
  };

  static responder = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = parseQuestaoId(req.params.questaoId);

    if (!cursoId || !turmaId || !provaId || !questaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos',
      });
    }

    try {
      const data = responderQuestaoSchema.parse(req.body);
      const inscricaoId = req.body.inscricaoId || req.user?.id;

      if (!inscricaoId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'inscricaoId é obrigatório',
        });
      }

      await ensureAlunoPodeAcessarProva(req, turmaId, provaId, inscricaoId);
      const resposta = await questoesService.responder(
        cursoId,
        turmaId,
        provaId,
        questaoId,
        inscricaoId,
        data,
        {
          usuarioId: req.user?.id,
          ip: req.ip || req.socket.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
        },
      );
      res.status(200).json(resposta);
    } catch (error: any) {
      if (respondAcessoNegado(res, error)) return;
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para resposta',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error?.code === 'QUESTAO_NOT_FOUND' ||
        error?.code === 'INSCRICAO_NOT_FOUND' ||
        error?.code === 'VALIDATION_ERROR'
      ) {
        return res.status(400).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'RESPOSTA_ERROR',
        message: 'Erro ao registrar resposta',
        error: error?.message,
      });
    }
  };

  static corrigir = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = parseQuestaoId(req.params.questaoId);

    if (!cursoId || !turmaId || !provaId || !questaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos',
      });
    }

    try {
      const data = corrigirRespostaSchema.parse(req.body);
      const inscricaoId = req.body.inscricaoId || req.params.inscricaoId;

      if (!inscricaoId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'inscricaoId é obrigatório',
        });
      }

      const resposta = await questoesService.corrigir(
        cursoId,
        turmaId,
        provaId,
        questaoId,
        inscricaoId,
        data,
      );
      res.status(200).json(resposta);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para correção',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'RESPOSTA_NOT_FOUND' || error?.code === 'QUESTAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'CORRECAO_ERROR',
        message: 'Erro ao corrigir resposta',
        error: error?.message,
      });
    }
  };

  static listarRespostas = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);
    const questaoId = req.query.questaoId as string | undefined;
    const inscricaoId = req.query.inscricaoId as string | undefined;

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      await ensureAlunoPodeAcessarProva(req, turmaId, provaId, inscricaoId);
      const respostas = await questoesService.listarRespostas(
        cursoId,
        turmaId,
        provaId,
        questaoId,
        inscricaoId,
      );
      res.json({ data: respostas });
    } catch (error: any) {
      if (respondAcessoNegado(res, error)) return;
      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'RESPOSTAS_LIST_ERROR',
        message: 'Erro ao listar respostas',
        error: error?.message,
      });
    }
  };
}
