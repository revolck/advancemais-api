import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';

import { logger } from '@/utils/logger';
import { certificadosService } from '../services/certificados.service';
import { SITUACOES, alterarSituacaoEmLote } from '../services/inscricoes-situacao.service';
import {
  adicionarAlunos,
  historicoDeInscricoesDaTurma,
  removerAlunos,
} from '../services/inscricoes-equipe.service';

const log = logger.child({ controller: 'TurmaSituacaoController' });

const paramsSchema = z.object({
  cursoId: z.string().uuid('Curso inválido'),
  turmaId: z.string().uuid('Turma inválida'),
});

const situacaoSchema = z
  .object({
    inscricaoIds: z.array(z.string().uuid()).max(5000).optional(),
    cpfs: z.array(z.string().trim().min(1).max(20)).max(5000).optional(),
    aplicarAosDemais: z.boolean().optional(),
    situacao: z.enum(
      Object.keys(SITUACOES) as [keyof typeof SITUACOES, ...(keyof typeof SITUACOES)[]],
      {
        errorMap: () => ({ message: 'Situação inválida' }),
      },
    ),
    motivo: z
      .string({ required_error: 'Informe o motivo' })
      .trim()
      .min(5, 'O motivo deve ter pelo menos 5 caracteres')
      .max(480, 'O motivo deve ter no máximo 480 caracteres'),
    simular: z.boolean().optional(),
    totalEsperado: z.number().int().nonnegative().optional(),
    avisar: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.inscricaoIds?.length || v.cpfs?.length), {
    message: 'Selecione alunos ou informe uma lista de CPFs',
    path: ['inscricaoIds'],
  });

const motivoSchema = z
  .string({ required_error: 'Informe o motivo' })
  .trim()
  .min(5, 'O motivo deve ter pelo menos 5 caracteres')
  .max(480, 'O motivo deve ter no máximo 480 caracteres');

const adicaoSchema = z.object({
  alunoIds: z
    .array(z.string().uuid('Aluno inválido'))
    .min(1, 'Selecione pelo menos um aluno')
    .max(200),
  motivo: motivoSchema,
  pagamento: z.enum(['CONCEDIDO', 'COBRANCA_PENDENTE'], {
    errorMap: () => ({ message: 'Escolha como fica o pagamento' }),
  }),
  avisar: z.boolean().optional(),
  simular: z.boolean().optional(),
  origem: z.enum(['TURMA', 'ALUNO']).optional(),
});

const remocaoSchema = z.object({
  inscricaoIds: z
    .array(z.string().uuid('Inscrição inválida'))
    .min(1, 'Selecione pelo menos um aluno')
    .max(200),
  motivo: motivoSchema,
  avisar: z.boolean().optional(),
  simular: z.boolean().optional(),
  totalEsperado: z.number().int().nonnegative().optional(),
});

const atorDa = (req: Request) => ({
  id: req.user!.id,
  role: req.user?.role ?? null,
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

const emissaoSchema = z.object({
  simular: z.boolean().optional(),
  limite: z.number().int().min(1).max(200).optional(),
});

const responderErro = (res: Response, error: any, acao: string) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: error.issues[0]?.message ?? 'Dados inválidos',
      issues: error.flatten().fieldErrors,
    });
  }
  const status = typeof error?.statusCode === 'number' ? error.statusCode : null;
  if (status && status < 500) {
    return res.status(status).json({ success: false, code: error.code, message: error.message });
  }
  if (error?.code === 'TURMA_NOT_FOUND') {
    return res.status(404).json({ success: false, code: error.code, message: error.message });
  }
  log.error({ err: error }, acao);
  return res.status(500).json({
    success: false,
    code: 'TURMA_SITUACAO_ERROR',
    message: 'Não foi possível concluir a operação. Tente novamente.',
  });
};

export class TurmaSituacaoController {
  /** POST /:cursoId/turmas/:turmaId/inscricoes/situacao */
  static alterarSituacao = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = paramsSchema.parse(req.params);
      const body = situacaoSchema.parse(req.body ?? {});
      const resultado = await alterarSituacaoEmLote(
        { cursoId, turmaId, ...body },
        {
          id: req.user!.id,
          role: req.user?.role ?? null,
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        },
      );
      return res.json({ success: true, data: resultado });
    } catch (error) {
      return responderErro(res, error, 'Erro ao alterar situação das inscrições');
    }
  };

  /** POST /:cursoId/turmas/:turmaId/inscricoes/equipe: adiciona ou reativa alunos */
  static adicionarAlunos = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = paramsSchema.parse(req.params);
      const { origem, ...body } = adicaoSchema.parse(req.body ?? {});
      const resultado = await adicionarAlunos(
        { cursoId, turmaId, ...body, origemAcao: origem ?? 'TURMA' },
        atorDa(req),
      );
      return res.json({ success: true, data: resultado });
    } catch (error) {
      return responderErro(res, error, 'Erro ao adicionar alunos à turma');
    }
  };

  /** POST /:cursoId/turmas/:turmaId/inscricoes/remover: desvincula preservando histórico */
  static removerAlunos = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = paramsSchema.parse(req.params);
      const body = remocaoSchema.parse(req.body ?? {});
      const resultado = await removerAlunos({ cursoId, turmaId, ...body }, atorDa(req));
      return res.json({ success: true, data: resultado });
    } catch (error) {
      return responderErro(res, error, 'Erro ao remover alunos da turma');
    }
  };

  /** GET /:cursoId/turmas/:turmaId/inscricoes/historico */
  static historico = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = paramsSchema.parse(req.params);
      const data = await historicoDeInscricoesDaTurma(cursoId, turmaId);
      return res.json({ success: true, data });
    } catch (error) {
      return responderErro(res, error, 'Erro ao carregar o histórico de inscrições');
    }
  };

  /** POST /:cursoId/turmas/:turmaId/certificados/concluintes */
  static emitirParaConcluintes = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = paramsSchema.parse(req.params);
      const body = emissaoSchema.parse(req.body ?? {});
      const resultado = await certificadosService.emitirParaConcluintes(
        cursoId,
        turmaId,
        body,
        req.user?.id,
      );
      return res.json({ success: true, data: resultado });
    } catch (error) {
      return responderErro(res, error, 'Erro ao emitir certificados dos concluintes');
    }
  };
}
