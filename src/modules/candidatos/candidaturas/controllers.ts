import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { ZodError } from 'zod';

import { prisma } from '@/config/prisma';
import { candidaturasService } from './services';
import { candidaturasOverviewService } from './services/overview.service';
import { candidaturasOverviewQuerySchema } from './validators/overview.schema';

export const CandidaturasController = {
  listMine: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.query.usuarioId;
      if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const { vagaId, status } = req.query as any;
      const statusList = Array.isArray(status) ? status : status ? [status] : [];
      const items = await candidaturasService.listMine({
        usuarioId: String(usuarioId),
        vagaId: vagaId as string | undefined,
        statusIds: statusList as any,
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ success: false, code: 'LIST_MINE_ERROR', message: error?.message });
    }
  },

  listReceived: async (req: Request, res: Response) => {
    try {
      const empresaUsuarioId = (req as any).user?.id || req.query.UsuariosUsuarioId;
      if (!empresaUsuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const { vagaId, status } = req.query as any;
      const statusList = Array.isArray(status) ? status : status ? [status] : [];
      const items = await candidaturasService.listReceived({
        empresaUsuarioId: String(empresaUsuarioId),
        vagaId: vagaId as string | undefined,
        statusIds: statusList as any,
      });
      res.json(items);
    } catch (error: any) {
      res
        .status(500)
        .json({ success: false, code: 'LIST_RECEIVED_ERROR', message: error?.message });
    }
  },
  overview: async (req: Request, res: Response) => {
    const user = (req as any).user;
    const allowedRoles = [
      Roles.EMPRESA,
      Roles.ADMIN,
      Roles.MODERADOR,
      Roles.SETOR_DE_VAGAS,
      Roles.RECRUTADOR,
    ] as const satisfies readonly Roles[];

    type AllowedRole = (typeof allowedRoles)[number];

    const isAllowedRole = (role: Roles): role is AllowedRole =>
      allowedRoles.includes(role as AllowedRole);

    if (!user?.id || !user?.role) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }

    const viewerRole = user.role as Roles;

    if (!isAllowedRole(viewerRole)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN' });
    }

    try {
      const query = candidaturasOverviewQuerySchema.parse(req.query);

      const result = await candidaturasOverviewService.list({
        ...query,
        viewerId: String(user.id),
        viewerRole,
      });

      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar o overview de candidaturas',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CANDIDATURAS_OVERVIEW_ERROR',
        message: error instanceof Error ? error.message : 'Erro ao gerar overview de candidaturas',
      });
    }
  },
  apply: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.body.usuarioId;
      const role: Roles = (req as any).user?.role || Roles.ALUNO_CANDIDATO;
      const { vagaId, curriculoId, consentimentos } = req.body as any;
      if (!usuarioId || !vagaId || !curriculoId)
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR' });
      const created = await candidaturasService.apply({
        usuarioId: String(usuarioId),
        role,
        vagaId,
        curriculoId,
        consentimentos,
      });
      res.status(201).json({ success: true, candidatura: created });
    } catch (error: any) {
      if (error?.code === 'FORBIDDEN')
        return res.status(403).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'CURRICULO_INVALIDO')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'VAGA_NOT_FOUND')
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'VAGA_LIMIT_CANDIDATURAS')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      res.status(500).json({ success: false, code: 'APPLY_ERROR', message: error?.message });
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const candidaturaId = req.params.id;

      if (!candidaturaId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'ID da candidatura é obrigatório',
        });
      }

      const candidatura = await candidaturasService.getById(candidaturaId);

      if (!candidatura) {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATURA_NOT_FOUND',
          message: 'Candidatura não encontrada',
        });
      }

      // Mapear dados para formato mais amigável
      const candidatoRaw = candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios;
      const vagaRaw = candidatura.EmpresasVagas;
      const curriculoRaw = candidatura.UsuariosCurriculos;

      const candidato = candidatoRaw
        ? {
            id: candidatoRaw.id,
            nome: candidatoRaw.nomeCompleto,
            nomeCompleto: candidatoRaw.nomeCompleto,
            email: candidatoRaw.email,
            cpf: candidatoRaw.cpf ?? null,
            telefone: candidatoRaw.UsuariosInformation?.telefone ?? null,
            genero: candidatoRaw.UsuariosInformation?.genero ?? null,
            dataNasc: candidatoRaw.UsuariosInformation?.dataNasc ?? null,
            avatarUrl: candidatoRaw.UsuariosInformation?.avatarUrl ?? null,
            descricao: candidatoRaw.UsuariosInformation?.descricao ?? null,
            cidade: candidatoRaw.UsuariosEnderecos?.[0]?.cidade ?? null,
            estado: candidatoRaw.UsuariosEnderecos?.[0]?.estado ?? null,
            status: candidatoRaw.status,
            role: candidatoRaw.role,
            tipoUsuario: candidatoRaw.tipoUsuario,
            criadoEm: candidatoRaw.criadoEm,
            atualizadoEm: candidatoRaw.atualizadoEm,
          }
        : null;

      const vaga = vagaRaw
        ? {
            id: vagaRaw.id,
            codigo: vagaRaw.codigo,
            titulo: vagaRaw.titulo,
            slug: vagaRaw.slug,
            status: vagaRaw.status,
            descricao: vagaRaw.descricao ?? null,
            localizacao: vagaRaw.localizacao ?? null,
            modalidade: vagaRaw.modalidade ?? null,
            regimeDeTrabalho: vagaRaw.regimeDeTrabalho ?? null,
            senioridade: vagaRaw.senioridade ?? null,
            inseridaEm: vagaRaw.inseridaEm,
            empresa: vagaRaw.Usuarios
              ? {
                  id: vagaRaw.Usuarios.id,
                  nome: vagaRaw.Usuarios.nomeCompleto,
                  avatarUrl: vagaRaw.Usuarios.UsuariosInformation?.avatarUrl ?? null,
                }
              : null,
          }
        : null;

      const curriculo = curriculoRaw
        ? {
            id: curriculoRaw.id,
            usuarioId: curriculoRaw.usuarioId,
            titulo: curriculoRaw.titulo ?? null,
            resumo: curriculoRaw.resumo ?? null,
            objetivo: curriculoRaw.objetivo ?? null,
            principal: curriculoRaw.principal,
            areasInteresse: curriculoRaw.areasInteresse ?? null,
            preferencias: curriculoRaw.preferencias ?? null,
            habilidades: curriculoRaw.habilidades ?? null,
            idiomas: curriculoRaw.idiomas ?? null,
            experiencias: curriculoRaw.experiencias ?? null,
            formacao: curriculoRaw.formacao ?? null,
            cursosCertificacoes: curriculoRaw.cursosCertificacoes ?? null,
            premiosPublicacoes: curriculoRaw.premiosPublicacoes ?? null,
            acessibilidade: curriculoRaw.acessibilidade ?? null,
            consentimentos: curriculoRaw.consentimentos ?? null,
            ultimaAtualizacao: curriculoRaw.ultimaAtualizacao,
            criadoEm: curriculoRaw.criadoEm,
            atualizadoEm: curriculoRaw.atualizadoEm,
          }
        : null;

      const response = {
        id: candidatura.id,
        vagaId: candidatura.vagaId,
        candidatoId: candidatura.candidatoId,
        curriculoId: candidatura.curriculoId,
        empresaUsuarioId: candidatura.empresaUsuarioId,
        statusId: candidatura.statusId,
        status: candidatura.status_processo?.nome ?? 'DESCONHECIDO',
        status_processo: candidatura.status_processo,
        origem: candidatura.origem,
        aplicadaEm: candidatura.aplicadaEm,
        atualizadaEm: candidatura.atualizadaEm,
        consentimentos: candidatura.consentimentos ?? null,
        candidato,
        vaga,
        curriculo,
      };

      res.json({ success: true, candidatura: response });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'GET_CANDIDATURA_ERROR',
        message: error?.message,
      });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const candidaturaId = req.params.id;
      const usuarioId = (req as any).user?.id;
      const { status: statusId } = req.body as any;

      if (!candidaturaId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'ID da candidatura é obrigatório',
        });
      }

      const role: Roles = (req as any).user?.role || Roles.ALUNO_CANDIDATO;
      const candidatura = await candidaturasService.update({
        id: candidaturaId,
        statusId,
        usuarioId,
        role,
      });

      res.json({ success: true, candidatura });
    } catch (error: any) {
      if (error?.code === 'CANDIDATURA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        code: 'UPDATE_CANDIDATURA_ERROR',
        message: error?.message,
      });
    }
  },

  cancel: async (req: Request, res: Response) => {
    try {
      const candidaturaId = req.params.id;
      const usuarioId = (req as any).user?.id;

      if (!candidaturaId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'ID da candidatura é obrigatório',
        });
      }

      const role: Roles = (req as any).user?.role || Roles.ALUNO_CANDIDATO;
      await candidaturasService.cancel({ id: candidaturaId, usuarioId, role });

      res.json({ success: true, message: 'Candidatura cancelada com sucesso' });
    } catch (error: any) {
      if (error?.code === 'CANDIDATURA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        code: 'CANCEL_CANDIDATURA_ERROR',
        message: error?.message,
      });
    }
  },

  listStatusDisponiveis: async (_req: Request, res: Response) => {
    try {
      const statusList = await prisma.status_processo.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          descricao: true,
          ativo: true,
          isDefault: true,
        },
      });

      res.json({
        success: true,
        data: statusList,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'LIST_STATUS_ERROR',
        message: error?.message || 'Erro ao listar status disponíveis',
      });
    }
  },
};
