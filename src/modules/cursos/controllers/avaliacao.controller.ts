import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { avaliacaoService } from '../services/avaliacao.service';
import { traduzirModelosPrisma } from '../utils/avaliacao';
import {
  registrarRecuperacaoSchema,
  updateRegrasAvaliacaoSchema,
} from '../validators/avaliacao.schema';

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

export class AvaliacaoController {
  static getRules = async (req: Request, res: Response) => {
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
      const regras = await avaliacaoService.obterRegras(cursoId, turmaId);
      res.json(regras);
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
        code: 'AVALIACAO_RULES_ERROR',
        message: 'Erro ao buscar regras de avaliação da turma',
        error: error?.message,
      });
    }
  };

  static updateRules = async (req: Request, res: Response) => {
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
      const data = updateRegrasAvaliacaoSchema.parse(req.body);
      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualizar as regras de avaliação',
        });
      }

      const modelosRecuperacao = data.modelosRecuperacao
        ? traduzirModelosPrisma(data.modelosRecuperacao)
        : undefined;
      const ordemAplicacaoRecuperacao = data.ordemAplicacaoRecuperacao
        ? traduzirModelosPrisma(data.ordemAplicacaoRecuperacao)
        : undefined;

      const regras = await avaliacaoService.atualizarRegras(cursoId, turmaId, {
        mediaMinima: data.mediaMinima ?? undefined,
        politicaRecuperacaoAtiva: data.politicaRecuperacaoAtiva ?? undefined,
        modelosRecuperacao,
        ordemAplicacaoRecuperacao,
        notaMaximaRecuperacao: data.notaMaximaRecuperacao ?? undefined,
        pesoProvaFinal: data.pesoProvaFinal ?? undefined,
        observacoes: data.observacoes ?? undefined,
      });

      res.json(regras);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização das regras de avaliação',
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

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_RULES_UPDATE_ERROR',
        message: 'Erro ao atualizar regras de avaliação da turma',
        error: error?.message,
      });
    }
  };

  static registrarRecuperacao = async (req: Request, res: Response) => {
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
      const parsed = registrarRecuperacaoSchema.parse(req.body);
      const modeloAplicado = parsed.modeloAplicado
        ? traduzirModelosPrisma([parsed.modeloAplicado])[0]
        : undefined;

      const recuperacao = await avaliacaoService.registrarRecuperacao(cursoId, turmaId, {
        inscricaoId: parsed.inscricaoId,
        provaId: parsed.provaId ?? null,
        envioId: parsed.envioId ?? null,
        notaRecuperacao: parsed.notaRecuperacao ?? null,
        notaFinal: parsed.notaFinal ?? null,
        mediaCalculada: parsed.mediaCalculada ?? null,
        modeloAplicado: modeloAplicado ?? null,
        detalhes: parsed.detalhes ?? null,
        observacoes: parsed.observacoes ?? null,
        aplicadoEm: parsed.aplicadoEm ?? undefined,
      });
      res.status(201).json(recuperacao);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para registro de recuperação',
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

      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'ENVIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ENVIO_NOT_FOUND',
          message: 'Envio de prova não encontrado para a inscrição informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_RECUPERACAO_ERROR',
        message: 'Erro ao registrar recuperação da turma',
        error: error?.message,
      });
    }
  };

  static getGrades = async (req: Request, res: Response) => {
    const inscricaoId = req.params.inscricaoId;

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de inscrição inválido',
      });
    }

    try {
      const boletim = await avaliacaoService.calcularNotasInscricao(inscricaoId, undefined, {
        permitirAdmin: true,
      });
      res.json(boletim);
    } catch (error: any) {
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_GRADE_ERROR',
        message: 'Erro ao consultar notas da inscrição',
        error: error?.message,
      });
    }
  };

  static getMyGrades = async (req: Request, res: Response) => {
    const inscricaoId = req.params.inscricaoId;
    const usuarioId = req.user?.id;

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de inscrição inválido',
      });
    }

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    try {
      const boletim = await avaliacaoService.calcularNotasInscricao(inscricaoId, usuarioId);
      res.json(boletim);
    } catch (error: any) {
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar as notas desta inscrição',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_GRADE_ME_ERROR',
        message: 'Erro ao consultar notas da inscrição do aluno',
        error: error?.message,
      });
    }
  };
}
