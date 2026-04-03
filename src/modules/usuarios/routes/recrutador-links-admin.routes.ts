import { Router } from 'express';
import { ZodError } from 'zod';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { logger } from '@/utils/logger';

import { recrutadorLinksAdminService } from '../services/recrutador-links-admin.service';
import {
  recruiterLinkCreateBodySchema,
  recruiterLinkDeleteParamsSchema,
  recruiterLinkUserParamsSchema,
  recruiterLinkVagaOptionsQuerySchema,
} from '../validators/recruiter-links.schema';

const router = Router();
const routeLogger = logger.child({ module: 'RecrutadorLinksAdminRoutes' });
const managerRoles = [Roles.ADMIN, Roles.MODERADOR];

const sendError = (res: any, error: unknown, fallbackCode: string, fallbackMessage: string) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos para vínculos do recrutador.',
      issues: error.flatten().fieldErrors,
    });
  }

  const status = typeof (error as any)?.status === 'number' ? (error as any).status : null;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({
      success: false,
      code: (error as any)?.code ?? fallbackCode,
      message: error instanceof Error ? error.message : fallbackMessage,
    });
  }

  routeLogger.error({ err: error }, fallbackMessage);
  return res.status(500).json({
    success: false,
    code: fallbackCode,
    message: fallbackMessage,
  });
};

router.get(
  '/usuarios/:userId/vinculos-recrutador',
  supabaseAuthMiddleware(managerRoles),
  async (req, res) => {
    try {
      const { userId } = recruiterLinkUserParamsSchema.parse(req.params);
      const data = await recrutadorLinksAdminService.list(userId);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        error,
        'RECRUITER_LINK_ERROR',
        'Não foi possível carregar os vínculos do recrutador.',
      );
    }
  },
);

router.get(
  '/usuarios/:userId/vinculos-recrutador/opcoes/empresas',
  supabaseAuthMiddleware(managerRoles),
  async (req, res) => {
    try {
      const { userId } = recruiterLinkUserParamsSchema.parse(req.params);
      const data = await recrutadorLinksAdminService.listEmpresaOptions(userId);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        error,
        'RECRUITER_LINK_ERROR',
        'Não foi possível carregar as empresas elegíveis do recrutador.',
      );
    }
  },
);

router.get(
  '/usuarios/:userId/vinculos-recrutador/opcoes/vagas',
  supabaseAuthMiddleware(managerRoles),
  async (req, res) => {
    try {
      const { userId } = recruiterLinkUserParamsSchema.parse(req.params);
      const { empresaUsuarioId } = recruiterLinkVagaOptionsQuerySchema.parse(req.query);
      const data = await recrutadorLinksAdminService.listVagaOptions(userId, empresaUsuarioId);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(
        res,
        error,
        'RECRUITER_LINK_ERROR',
        'Não foi possível carregar as vagas elegíveis do recrutador.',
      );
    }
  },
);

router.post(
  '/usuarios/:userId/vinculos-recrutador',
  supabaseAuthMiddleware(managerRoles),
  async (req, res) => {
    try {
      const { userId } = recruiterLinkUserParamsSchema.parse(req.params);
      const payload = recruiterLinkCreateBodySchema.parse(req.body);
      const data = await recrutadorLinksAdminService.create(userId, payload, {
        actorId: req.user?.id ?? null,
        actorNome: req.user?.nomeCompleto ?? null,
        actorRole: req.user?.role ?? null,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      });
      return res.status(201).json({
        success: true,
        code: 'RECRUITER_LINK_CREATED',
        message: 'Vínculo do recrutador criado com sucesso.',
        data,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        'RECRUITER_LINK_ERROR',
        'Não foi possível criar o vínculo do recrutador.',
      );
    }
  },
);

router.delete(
  '/usuarios/:userId/vinculos-recrutador/:vinculoId',
  supabaseAuthMiddleware(managerRoles),
  async (req, res) => {
    try {
      const { userId, vinculoId } = recruiterLinkDeleteParamsSchema.parse(req.params);
      await recrutadorLinksAdminService.remove(userId, vinculoId, {
        actorId: req.user?.id ?? null,
        actorNome: req.user?.nomeCompleto ?? null,
        actorRole: req.user?.role ?? null,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      });
      return res.json({
        success: true,
        code: 'RECRUITER_LINK_REMOVED',
        message: 'Vínculo do recrutador removido com sucesso.',
      });
    } catch (error) {
      return sendError(
        res,
        error,
        'RECRUITER_LINK_ERROR',
        'Não foi possível remover o vínculo do recrutador.',
      );
    }
  },
);

export default router;
