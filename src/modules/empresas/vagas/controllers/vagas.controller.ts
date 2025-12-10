import { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { StatusDeVagas } from '@prisma/client';
import { setCacheHeaders, DEFAULT_TTL } from '@/utils/cache';
import { Roles } from '@/modules/usuarios/enums/Roles';

import { vagasService } from '@/modules/empresas/vagas/services/vagas.service';
import {
  EmpresaSemPlanoAtivoError,
  LimiteVagasDestaqueAtingidoError,
  LimiteVagasPlanoAtingidoError,
  PlanoNaoPermiteVagaDestaqueError,
  VagaAreaSubareaError,
} from '@/modules/empresas/vagas/services/errors';
import {
  createVagaSchema,
  updateVagaSchema,
} from '@/modules/empresas/vagas/validators/vagas.schema';

export class VagasController {
  static list = async (_req: Request, res: Response) => {
    try {
      const { status, usuarioId, page, pageSize } = _req.query as {
        status?: string | string[];
        usuarioId?: string;
        page?: string;
        pageSize?: string;
      };

      const validStatuses = new Set<StatusDeVagas>([
        'RASCUNHO',
        'EM_ANALISE',
        'PUBLICADO',
        'EXPIRADO',
        'DESPUBLICADA',
        'PAUSADA',
        'ENCERRADA',
      ] as const);
      const restrictedStatuses = new Set<StatusDeVagas>([
        'RASCUNHO',
        'EM_ANALISE',
        'DESPUBLICADA',
        'PAUSADA',
        'ENCERRADA',
      ]);
      const allowedRoles: Roles[] = [
        Roles.ADMIN,
        Roles.MODERADOR,
        Roles.EMPRESA,
        Roles.SETOR_DE_VAGAS,
        Roles.ALUNO_CANDIDATO,
      ];
      let statusesFilter: StatusDeVagas[] | undefined = undefined;

      // Normaliza status para array (aceita string, string[] ou valores separados por vírgula)
      const normalizeStatusInput = (input: string | string[] | undefined): string[] => {
        if (!input) return [];
        if (Array.isArray(input)) {
          // Se for array, processa cada item (pode conter vírgulas também)
          return input.flatMap((item) =>
            item
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
          );
        }
        // Se for string, faz split por vírgula
        return input
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      };

      const normalizedStatuses = normalizeStatusInput(status);

      if (normalizedStatuses.length > 0) {
        // Verifica se é pedido para retornar todos os status
        if (normalizedStatuses.some((s) => s === 'ALL' || s === 'TODAS' || s === 'TODOS')) {
          statusesFilter = [
            'RASCUNHO',
            'EM_ANALISE',
            'PUBLICADO',
            'EXPIRADO',
            'DESPUBLICADA',
            'PAUSADA',
            'ENCERRADA',
          ];
        } else {
          const chosen = normalizedStatuses.filter((s): s is StatusDeVagas =>
            validStatuses.has(s as StatusDeVagas),
          );
          if (chosen.length > 0) {
            statusesFilter = chosen;
          }
        }
      }

      // Proteção: exige autenticação/roles para RASCUNHO ou EM_ANALISE
      const includesRestricted = Array.isArray(statusesFilter)
        ? statusesFilter.some((s) => restrictedStatuses.has(s))
        : false;

      if (includesRestricted) {
        const user = _req.user;
        if (!user) {
          return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Token de autorização necessário para consultar vagas não públicas',
          });
        }
        if (!allowedRoles.includes(user.role as Roles)) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Acesso negado: permissões insuficientes para consultar vagas não públicas',
          });
        }
      }

      const vagas = await vagasService.list({
        status: statusesFilter,
        usuarioId: typeof usuarioId === 'string' ? usuarioId : undefined,
        page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
        pageSize: pageSize ? Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10)) : undefined,
      });
      const ttl = Number(process.env.VAGAS_CACHE_TTL || DEFAULT_TTL);
      const etag = setCacheHeaders(res, vagas, ttl);
      const ifNoneMatch = _req.headers['if-none-match'];
      const tags = Array.isArray(ifNoneMatch)
        ? ifNoneMatch
        : typeof ifNoneMatch === 'string'
          ? ifNoneMatch.split(',').map((v) => v.trim().replace(/^W\//, '').replace(/"/g, ''))
          : [];
      if (tags.includes(etag)) {
        return res.status(304).end();
      }
      res.json(vagas);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_LIST_ERROR',
        message: 'Erro ao listar vagas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const vaga = await vagasService.get(id);

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.json(vaga);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_GET_ERROR',
        message: 'Erro ao buscar vaga',
        error: error?.message,
      });
    }
  };

  static getBySlug = async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const vaga = await vagasService.getBySlug(slug);

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.json(vaga);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_GET_ERROR',
        message: 'Erro ao buscar vaga',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createVagaSchema.parse(req.body);
      const vaga = await vagasService.create(data);
      res.status(201).json(vaga);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada para vincular à vaga',
        });
      }

      if (error instanceof VagaAreaSubareaError) {
        return res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof EmpresaSemPlanoAtivoError) {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof LimiteVagasPlanoAtingidoError) {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          limite: error.limite,
        });
      }

      if (error instanceof PlanoNaoPermiteVagaDestaqueError) {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof LimiteVagasDestaqueAtingidoError) {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          limite: error.limite,
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CREATE_ERROR',
        message: 'Erro ao criar vaga',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateVagaSchema.parse(req.body);

      const hasUpdates = Object.values(payload).some((value) => value !== undefined);
      if (!hasUpdates) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da vaga',
        });
      }

      const vaga = await vagasService.update(id, payload);
      res.json(vaga);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada para vincular à vaga',
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      if (error instanceof VagaAreaSubareaError) {
        return res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof EmpresaSemPlanoAtivoError) {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof PlanoNaoPermiteVagaDestaqueError) {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof LimiteVagasDestaqueAtingidoError) {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          limite: error.limite,
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_UPDATE_ERROR',
        message: 'Erro ao atualizar vaga',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await vagasService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_DELETE_ERROR',
        message: 'Erro ao remover vaga',
        error: error?.message,
      });
    }
  };
}
