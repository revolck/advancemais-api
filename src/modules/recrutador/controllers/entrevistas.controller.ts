import type { Request, Response } from 'express';
import { prisma } from '@/config/prisma';
import { Roles, StatusDeVagas } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';
import {
  AlunoNotFoundError,
  alunosEntrevistasService,
} from '@/modules/cursos/services/alunos-entrevistas.service';
import { alunoEntrevistasQuerySchema } from '@/modules/cursos/validators/alunos.schema';
import { entrevistasManageService } from '@/modules/entrevistas/services/manage.service';
import { entrevistasOverviewService } from '@/modules/entrevistas/services/overview.service';
import {
  createEntrevistaSchema as recruiterDashboardCreateEntrevistaSchema,
  entrevistasOpcoesCandidatosQuerySchema,
  entrevistasOpcoesVagasQuerySchema,
  entrevistasOverviewQuerySchema,
} from '@/modules/entrevistas/validators/overview.schema';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { ZodError, z } from 'zod';

import {
  recrutadorCandidatoIdParamSchema,
  recrutadorCriarEntrevistaNoCandidatoSchema,
} from '../validators/candidatos.schema';

const createEntrevistaSchema = z.object({
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  descricao: z.string().trim().max(5000).optional(),
});

const isDatabaseConnectionError = (error: unknown) => {
  const errorCode = (error as any)?.code;
  const errorMessage = String((error as any)?.message || '').toLowerCase();

  return (
    (error instanceof PrismaClientKnownRequestError &&
      (error.code === 'P1001' || error.code === 'P2024')) ||
    errorCode === 'P1001' ||
    errorCode === 'P2024' ||
    errorMessage.includes("can't reach database") ||
    errorMessage.includes('database server') ||
    errorMessage.includes('connection') ||
    errorMessage.includes("can't reach")
  );
};

const withCandidateInterviewDefaults = (
  items: {
    candidaturaId: string;
    entrevistaAtiva: boolean;
    empresa: { id: string };
    vaga: { id: string };
  }[],
) => {
  const creatableItems = items.filter((item) => !item.entrevistaAtiva);
  const empresaIds = [...new Set(creatableItems.map((item) => item.empresa.id))];
  const defaultEmpresaUsuarioId = empresaIds.length === 1 ? empresaIds[0] : null;

  const vagaCandidates = defaultEmpresaUsuarioId
    ? creatableItems.filter((item) => item.empresa.id === defaultEmpresaUsuarioId)
    : creatableItems;
  const vagaIds = [...new Set(vagaCandidates.map((item) => item.vaga.id))];
  const defaultVagaId = vagaIds.length === 1 ? vagaIds[0] : null;

  const candidaturaCandidates = defaultVagaId
    ? vagaCandidates.filter((item) => item.vaga.id === defaultVagaId)
    : vagaCandidates;
  const candidaturaIds = [...new Set(candidaturaCandidates.map((item) => item.candidaturaId))];
  const defaultCandidaturaId = candidaturaIds.length === 1 ? candidaturaIds[0] : null;

  return {
    empresaUsuarioId: defaultEmpresaUsuarioId,
    vagaId: defaultVagaId,
    candidaturaId: defaultCandidaturaId,
  };
};

export class RecrutadorEntrevistasController {
  static listOverview = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const parsed = entrevistasOverviewQuerySchema.parse(req.query);
      const filters = {
        ...parsed,
        pageSize: req.query.pageSize === undefined ? 10 : parsed.pageSize,
      };

      const [result, createCompanies] = await Promise.all([
        entrevistasOverviewService.list({
          ...filters,
          viewerId: recruiterId,
          viewerRole: Roles.RECRUTADOR,
        }),
        entrevistasManageService.listEmpresas({
          viewerId: recruiterId,
          viewerRole: Roles.RECRUTADOR,
        }),
      ]);

      const hasCreateOptions = createCompanies.items.length > 0;
      const google = result.capabilities.google;

      return res.json({
        success: true,
        data: {
          ...result,
          capabilities: {
            ...result.capabilities,
            canCreate: hasCreateOptions,
            canCreateOnline:
              hasCreateOptions && google?.connected === true && google?.expired !== true,
            canCreatePresencial: hasCreateOptions,
          },
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Os filtros informados para o overview de entrevistas são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso às entrevistas deste escopo.',
        });
      }

      if (isDatabaseConnectionError(error)) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Não foi possível carregar o overview de entrevistas do recrutador.',
        error: error?.message,
      });
    }
  };

  static listCreateEmpresas = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const result = await entrevistasManageService.listEmpresas({
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para criar entrevistas neste escopo.',
        });
      }

      if (isDatabaseConnectionError(error)) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_OPTIONS_ERROR',
        message: 'Não foi possível carregar as empresas elegíveis para entrevista.',
        error: error?.message,
      });
    }
  };

  static listCreateVagas = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const query = entrevistasOpcoesVagasQuerySchema.parse(req.query);
      const result = await entrevistasManageService.listVagas({
        ...query,
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Os filtros informados para listar vagas são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error.code ?? 'NOT_FOUND',
          message: error.message ?? 'Recurso não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para criar entrevistas nesta empresa.',
        });
      }

      if (isDatabaseConnectionError(error)) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_OPTIONS_ERROR',
        message: 'Não foi possível carregar as vagas elegíveis para entrevista.',
        error: error?.message,
      });
    }
  };

  static listCreateCandidatos = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const query = entrevistasOpcoesCandidatosQuerySchema.parse(req.query);
      const result = await entrevistasManageService.listCandidatos({
        ...query,
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Os filtros informados para listar candidatos são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error.code ?? 'NOT_FOUND',
          message: error.message ?? 'Recurso não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para criar entrevistas nesta vaga.',
        });
      }

      if (isDatabaseConnectionError(error)) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_OPTIONS_ERROR',
        message: 'Não foi possível carregar os candidatos elegíveis para entrevista.',
        error: error?.message,
      });
    }
  };

  static createOverviewInterview = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const payload = recruiterDashboardCreateEntrevistaSchema.parse(req.body);
      const result = await entrevistasManageService.create({
        ...payload,
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Os dados informados para criar a entrevista são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error.code ?? 'NOT_FOUND',
          message: error.message ?? 'Recurso não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para criar entrevista nesta candidatura.',
        });
      }

      if (error?.status === 409) {
        return res.status(409).json({
          success: false,
          code: error.code ?? 'RECRUITER_SCOPE_CONFLICT',
          message:
            error.message ??
            'Os dados informados não correspondem a uma candidatura válida no escopo do recrutador.',
        });
      }

      if (error?.status === 400) {
        return res.status(400).json({
          success: false,
          code: error.code ?? 'INTERVIEW_INVALID_PAYLOAD',
          message: error.message ?? 'Os dados informados para criar a entrevista são inválidos.',
        });
      }

      if (isDatabaseConnectionError(error)) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_CREATE_ERROR',
        message: 'Não foi possível criar a entrevista no dashboard do recrutador.',
        error: error?.message,
      });
    }
  };

  static listByCandidato = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { candidatoId } = recrutadorCandidatoIdParamSchema.parse(req.params);
      const filters = alunoEntrevistasQuerySchema.parse(req.query);
      const result = await alunosEntrevistasService.list({
        alunoId: candidatoId,
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
        filters,
      });

      return res.json({
        success: true,
        data: {
          items: result.items,
          pagination: result.pagination,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar entrevistas do candidato.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATO_NOT_FOUND',
          message: 'Candidato não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso às entrevistas deste candidato.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao listar entrevistas do candidato.',
        error: error?.message,
      });
    }
  };

  static listCreateOptionsByCandidato = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { candidatoId } = recrutadorCandidatoIdParamSchema.parse(req.params);
      const [result, directEmpresaIds] = await Promise.all([
        alunosEntrevistasService.listCreateOptions({
          alunoId: candidatoId,
          viewerId: recruiterId,
          viewerRole: Roles.RECRUTADOR,
        }),
        recrutadorEmpresasService.listDirectEmpresaUsuarioIds(recruiterId),
      ]);

      const items = result.items.map((item) => {
        const empresaVinculadaDiretamente = directEmpresaIds.includes(item.empresa.id);

        return {
          ...item,
          tipoAcesso: empresaVinculadaDiretamente ? 'EMPRESA' : 'VAGA',
          empresaVinculadaDiretamente,
        };
      });

      return res.json({
        success: true,
        data: {
          ...result,
          canCreate: items.some((item) => !item.entrevistaAtiva),
          defaults: withCandidateInterviewDefaults(items),
          items,
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar opções de entrevista do candidato.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATO_NOT_FOUND',
          message: 'Candidato não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para criar entrevista neste candidato.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_OPTIONS_ERROR',
        message: 'Não foi possível carregar as opções de entrevista do candidato.',
        error: error?.message,
      });
    }
  };

  static createByCandidato = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { candidatoId } = recrutadorCandidatoIdParamSchema.parse(req.params);
      const payload = recrutadorCriarEntrevistaNoCandidatoSchema.parse(req.body);

      const result = await alunosEntrevistasService.createForAluno({
        alunoId: candidatoId,
        viewerId: recruiterId,
        viewerRole: Roles.RECRUTADOR,
        payload,
        expectedEmpresaUsuarioId: payload.empresaUsuarioId,
        expectedVagaId: payload.vagaId,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Os dados informados para criar a entrevista são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATO_NOT_FOUND',
          message: 'Candidato não encontrado.',
        });
      }

      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error?.code ?? 'NOT_FOUND',
          message: error?.message ?? 'Recurso não encontrado.',
        });
      }

      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message:
            error?.message ?? 'Você não possui acesso para criar entrevista nesta candidatura.',
        });
      }

      if (error?.status === 409) {
        return res.status(409).json({
          success: false,
          code: error?.code ?? 'RECRUITER_SCOPE_CONFLICT',
          message:
            error?.message ??
            'Os dados informados não correspondem a uma candidatura válida no escopo do recrutador.',
        });
      }

      if (error?.status === 400) {
        return res.status(400).json({
          success: false,
          code: error?.code ?? 'VALIDATION_ERROR',
          message: error?.message ?? 'Os dados informados para criar a entrevista são inválidos.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_INTERVIEW_CREATE_ERROR',
        message: 'Não foi possível criar a entrevista no contexto do candidato.',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { vagaId, candidatoId } = req.params as { vagaId: string; candidatoId: string };
      const payload = createEntrevistaSchema.parse(req.body);
      const dataInicio = new Date(payload.dataInicio);
      const dataFim = new Date(payload.dataFim);

      if (
        Number.isNaN(dataInicio.getTime()) ||
        Number.isNaN(dataFim.getTime()) ||
        dataFim <= dataInicio
      ) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'dataInicio/dataFim inválidos',
        });
      }

      const vaga = await prisma.empresasVagas.findUnique({
        where: { id: vagaId },
        select: { id: true, titulo: true, status: true, usuarioId: true },
      });

      if (!vaga || vaga.status === StatusDeVagas.RASCUNHO) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      await recrutadorVagasService.assertVinculo(recruiterId, vagaId);
      await recrutadorEmpresasService.assertVinculo(recruiterId, vaga.usuarioId);

      const candidatura = await prisma.empresasCandidatos.findFirst({
        where: {
          vagaId,
          candidatoId,
          empresaUsuarioId: vaga.usuarioId,
        },
        select: { id: true },
      });

      if (!candidatura) {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATO_NOT_FOUND',
          message: 'Candidato não está relacionado a esta vaga',
        });
      }

      const [recrutador, candidato] = await prisma.$transaction([
        prisma.usuarios.findUnique({
          where: { id: recruiterId },
          select: { id: true, email: true, nomeCompleto: true },
        }),
        prisma.usuarios.findUnique({
          where: { id: candidatoId },
          select: { id: true, email: true, nomeCompleto: true },
        }),
      ]);

      if (!recrutador || !candidato || !candidato.email) {
        return res.status(404).json({
          success: false,
          code: 'USUARIO_NOT_FOUND',
          message: 'Recrutador ou candidato não encontrado',
        });
      }

      const titulo = `Entrevista ${candidato.nomeCompleto} - ${vaga.titulo}`;
      const descricao =
        payload.descricao ??
        `Entrevista agendada para a vaga "${vaga.titulo}".\n\nRecrutador: ${recrutador.nomeCompleto}\nCandidato: ${candidato.nomeCompleto}`;

      const { eventId, meetUrl } = await googleCalendarService.createMeetEvent({
        titulo,
        descricao,
        dataInicio,
        dataFim,
        instrutorId: recruiterId,
        alunoEmails: [candidato.email],
      });

      const entrevista = await prisma.empresasVagasEntrevistas.create({
        data: {
          vagaId,
          candidatoId,
          empresaUsuarioId: vaga.usuarioId,
          recrutadorId: recruiterId,
          titulo,
          descricao,
          dataInicio,
          dataFim,
          meetUrl,
          meetEventId: eventId,
        },
        select: {
          id: true,
          vagaId: true,
          candidatoId: true,
          empresaUsuarioId: true,
          recrutadorId: true,
          titulo: true,
          descricao: true,
          dataInicio: true,
          dataFim: true,
          meetUrl: true,
          meetEventId: true,
          status: true,
          criadoEm: true,
        },
      });

      // Sincronizar com Google Calendar do recrutador e candidato (em background)
      setImmediate(async () => {
        try {
          await googleCalendarService.sincronizarEntrevista({
            entrevistaId: entrevista.id,
            recrutadorId: recruiterId,
            candidatoId,
          });
        } catch (error: any) {
          // Log mas não falha a criação da entrevista
          console.error('[SYNC_ENTREVISTA_ERRO]', {
            entrevistaId: entrevista.id,
            error: error?.message,
          });
        }
      });

      return res.status(201).json({ success: true, entrevista });
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: error?.code ?? 'FORBIDDEN',
          message: error?.message ?? 'Acesso negado',
        });
      }

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para agendar entrevista',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_ENTREVISTA_CREATE_ERROR',
        message: 'Erro ao agendar entrevista',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { id } = req.params;

      const entrevista = await prisma.empresasVagasEntrevistas.findUnique({
        where: { id },
        select: {
          id: true,
          vagaId: true,
          candidatoId: true,
          empresaUsuarioId: true,
          recrutadorId: true,
          titulo: true,
          descricao: true,
          dataInicio: true,
          dataFim: true,
          meetUrl: true,
          meetEventId: true,
          status: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });

      if (!entrevista) {
        return res.status(404).json({
          success: false,
          code: 'ENTREVISTA_NOT_FOUND',
          message: 'Entrevista não encontrada',
        });
      }

      await recrutadorVagasService.assertVinculo(recruiterId, entrevista.vagaId);

      return res.json({ success: true, entrevista, data: entrevista });
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a esta entrevista.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_ENTREVISTA_GET_ERROR',
        message: 'Erro ao buscar entrevista',
        error: error?.message,
      });
    }
  };
}
