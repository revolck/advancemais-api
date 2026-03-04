import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { Roles } from '@/modules/usuarios/enums/Roles';

import { certificadosService } from '../services/certificados.service';
import {
  certificadoIdSchema,
  codigoCertificadoSchema,
  emitirCertificadoGlobalSchema,
  emitirCertificadoSchema,
  listarCertificadosGlobaisQuerySchema,
  listarCertificadosQuerySchema,
  listarMeCertificadosQuerySchema,
} from '../validators/certificados.schema';

const parseCursoId = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  // Cursos.id agora é UUID (String), não mais Int
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw.trim())) {
    return null;
  }
  return raw.trim();
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

const parseCertificadoId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

export class CertificadosController {
  static listarGlobal = async (req: Request, res: Response) => {
    const parsedQuery = listarCertificadosGlobaisQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros de consulta inválidos',
        issues: parsedQuery.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await certificadosService.listarGlobal(parsedQuery.data);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'CERTIFICADO_LIST_GLOBAL_ERROR',
        message: 'Erro ao listar certificados',
        error: error?.message,
      });
    }
  };

  static emitirGlobal = async (req: Request, res: Response) => {
    const parsedBody = emitirCertificadoGlobalSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos para emissão do certificado',
        issues: parsedBody.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await certificadosService.emitirGlobal(parsedBody.data, req.user?.id);
      return res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'ALUNO_FORA_DA_TURMA') {
        return res.status(400).json({
          success: false,
          code: 'ALUNO_FORA_DA_TURMA',
          message: 'Aluno não possui vínculo ativo com o curso/turma informados',
        });
      }

      if (error?.code === 'MODELO_CERTIFICADO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'MODELO_CERTIFICADO_INVALIDO',
          message: 'Modelo de certificado inválido',
        });
      }

      if (error?.code === 'CERTIFICADO_JA_EXISTE') {
        return res.status(409).json({
          success: false,
          code: 'CERTIFICADO_JA_EXISTE',
          message: 'Já existe certificado emitido para esta inscrição',
          data: error?.data ?? null,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CERTIFICADO_EMITIR_GLOBAL_ERROR',
        message: 'Erro ao emitir certificado',
        error: error?.message,
      });
    }
  };

  static getById = async (req: Request, res: Response) => {
    const parsedCertificadoId = certificadoIdSchema.safeParse(
      parseCertificadoId(req.params.certificadoId),
    );

    if (!parsedCertificadoId.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de certificado inválido',
        issues: parsedCertificadoId.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await certificadosService.getById(parsedCertificadoId.data);

      if (req.user?.role === Roles.ALUNO_CANDIDATO && result.data.aluno.id !== req.user.id) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este certificado',
        });
      }

      return res.json(result);
    } catch (error: any) {
      if (error?.code === 'MODELO_CERTIFICADO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'MODELO_CERTIFICADO_INVALIDO',
          message: 'Modelo de certificado inválido',
        });
      }

      if (error?.code === 'CERTIFICADO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CERTIFICADO_NOT_FOUND',
          message: 'Certificado não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CERTIFICADO_GET_ERROR',
        message: 'Erro ao buscar certificado',
        error: error?.message,
      });
    }
  };

  static previewById = async (req: Request, res: Response) => {
    const parsedCertificadoId = certificadoIdSchema.safeParse(
      parseCertificadoId(req.params.certificadoId),
    );

    if (!parsedCertificadoId.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de certificado inválido',
        issues: parsedCertificadoId.error.flatten().fieldErrors,
      });
    }

    try {
      const scoped = await certificadosService.getById(parsedCertificadoId.data);
      if (req.user?.role === Roles.ALUNO_CANDIDATO && scoped.data.aluno.id !== req.user.id) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este certificado',
        });
      }

      const html = await certificadosService.getPreviewHtml(parsedCertificadoId.data);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.type('text/html; charset=utf-8').send(html);
    } catch (error: any) {
      if (error?.code === 'MODELO_CERTIFICADO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'MODELO_CERTIFICADO_INVALIDO',
          message: 'Modelo de certificado inválido',
        });
      }

      if (error?.code === 'CERTIFICADO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CERTIFICADO_NOT_FOUND',
          message: 'Certificado não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CERTIFICADO_PREVIEW_ERROR',
        message: 'Erro ao gerar preview do certificado',
        error: error?.message,
      });
    }
  };

  static pdfById = async (req: Request, res: Response) => {
    const parsedCertificadoId = certificadoIdSchema.safeParse(
      parseCertificadoId(req.params.certificadoId),
    );

    if (!parsedCertificadoId.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de certificado inválido',
        issues: parsedCertificadoId.error.flatten().fieldErrors,
      });
    }

    try {
      const scoped = await certificadosService.getById(parsedCertificadoId.data);
      if (req.user?.role === Roles.ALUNO_CANDIDATO && scoped.data.aluno.id !== req.user.id) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este certificado',
        });
      }

      const pdfBuffer = await certificadosService.getPdfBuffer(parsedCertificadoId.data);
      const binaryPdf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(binaryPdf.length));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="certificado-${parsedCertificadoId.data}.pdf"`,
      );
      return res.send(binaryPdf);
    } catch (error: any) {
      if (error?.code === 'MODELO_CERTIFICADO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'MODELO_CERTIFICADO_INVALIDO',
          message: 'Modelo de certificado inválido',
        });
      }

      if (error?.code === 'CERTIFICADO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CERTIFICADO_NOT_FOUND',
          message: 'Certificado não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CERTIFICADO_PDF_ERROR',
        message: 'Erro ao gerar PDF do certificado',
        error: error?.message,
      });
    }
  };

  static listarModelos = async (_req: Request, res: Response) => {
    return res.json(certificadosService.listarModelos());
  };

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

    const parsedQuery = listarMeCertificadosQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros de consulta inválidos',
        issues: parsedQuery.error.flatten().fieldErrors,
      });
    }

    try {
      const certificados = await certificadosService.listarDoAlunoPaginado(
        usuarioId,
        parsedQuery.data,
      );
      res.json(certificados);
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
      const certificado = await certificadosService.verificarPorCodigoPublico(parsedCodigo.data);

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
