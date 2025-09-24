import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { certificadosService } from '../services/certificados.service';
import {
  codigoCertificadoSchema,
  emitirCertificadoSchema,
  listarCertificadosQuerySchema,
} from '../validators/certificados.schema';

const parseCursoId = (raw: unknown) => {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseTurmaId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
};

const parseInscricaoId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
};

const ensureSingleValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export class CertificadosController {
  static emitir = async (req: Request, res: Response) => {
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
      const payload = emitirCertificadoSchema.parse(req.body);
      const usuarioId = req.user?.id;

      const certificado = await certificadosService.emitir(cursoId, turmaId, payload, usuarioId);

      res.status(201).json(certificado);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para emissão do certificado',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: 'Turma ou inscrição não encontrada para emissão do certificado',
        });
      }

      if (error?.code === 'INVALID_CARGA_HORARIA') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CARGA_HORARIA',
          message: 'Informe uma carga horária válida para o certificado',
        });
      }

      if (error?.code === 'ESTAGIO_NAO_CONCLUIDO') {
        return res.status(409).json({
          success: false,
          code: 'ESTAGIO_NAO_CONCLUIDO',
          message: 'O certificado só pode ser emitido após a conclusão do estágio obrigatório.',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CERTIFICADO_EMITIR_ERROR',
        message: 'Erro ao emitir certificado para a turma',
        error: error?.message,
      });
    }
  };

  static listar = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    const parsedQuery = listarCertificadosQuerySchema.safeParse({
      inscricaoId: ensureSingleValue(req.query.inscricaoId),
      tipo: ensureSingleValue(req.query.tipo),
      formato: ensureSingleValue(req.query.formato),
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros de consulta inválidos',
        issues: parsedQuery.error.flatten().fieldErrors,
      });
    }

    try {
      const certificados = await certificadosService.listar(cursoId, turmaId, parsedQuery.data);
      res.json({ data: certificados });
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
        code: 'CERTIFICADO_LIST_ERROR',
        message: 'Erro ao listar certificados da turma',
        error: error?.message,
      });
    }
  };

  static listarPorInscricao = async (req: Request, res: Response) => {
    const inscricaoId = parseInscricaoId(req.params.inscricaoId);

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    try {
      const resultado = await certificadosService.listarPorInscricao(inscricaoId, undefined, {
        permitirAdmin: true,
      });
      res.json(resultado);
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
        code: 'CERTIFICADO_INSCRICAO_ERROR',
        message: 'Erro ao consultar certificados da inscrição',
        error: error?.message,
      });
    }
  };

  static listarMePorInscricao = async (req: Request, res: Response) => {
    const inscricaoId = parseInscricaoId(req.params.inscricaoId);

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    try {
      const resultado = await certificadosService.listarPorInscricao(inscricaoId, usuarioId);
      res.json(resultado);
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
          message: 'Você não possui acesso aos certificados desta inscrição',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CERTIFICADO_INSCRICAO_ERROR',
        message: 'Erro ao consultar certificados da inscrição',
        error: error?.message,
      });
    }
  };

  static listarMe = async (req: Request, res: Response) => {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    try {
      const certificados = await certificadosService.listarDoAluno(usuarioId);
      res.json({ data: certificados });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CERTIFICADO_ME_ERROR',
        message: 'Erro ao consultar certificados do aluno',
        error: error?.message,
      });
    }
  };

  static verificarPorCodigo = async (req: Request, res: Response) => {
    const parsedCodigo = codigoCertificadoSchema.safeParse(req.params.codigo);

    if (!parsedCodigo.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Código do certificado inválido',
        issues: parsedCodigo.error.flatten().fieldErrors,
      });
    }

    try {
      const certificado = await certificadosService.verificarPorCodigo(parsedCodigo.data);

      if (!certificado) {
        return res.status(404).json({
          success: false,
          code: 'CERTIFICADO_NOT_FOUND',
          message: 'Certificado não encontrado para o código informado',
        });
      }

      res.json(certificado);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CERTIFICADO_VERIFICAR_ERROR',
        message: 'Erro ao verificar certificado pelo código',
        error: error?.message,
      });
    }
  };
}
