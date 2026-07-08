import crypto from 'crypto';
import { Request, Response } from 'express';

import { respondWithCache } from '@/modules/website/utils/cache-response';
import { websitePopupsService } from '@/modules/website/services/popups.service';
import {
  activePopupsQuerySchema,
  createPopupLeadInterestSchema,
  createPopupLeadNoteSchema,
  createPopupLeadOpportunitySchema,
  createPopupContactSchema,
  createPopupSchema,
  listPopupsQuerySchema,
  popupLeadListQuerySchema,
  updatePopupSchema,
  updatePopupLeadNoteSchema,
  updatePopupLeadOpportunitySchema,
  updatePopupLeadSchema,
} from '@/modules/website/validators/popups.schema';

function formatValidationError(error: unknown) {
  if (error && typeof error === 'object' && 'flatten' in error) {
    return (error as { flatten: () => unknown }).flatten();
  }
  return error;
}

function getRequestIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
}

function getActorContext(req: Request) {
  return {
    userId: req.user?.id ?? null,
    ip: getRequestIp(req) || null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

function hashIp(ip: string) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function getErrorStatus(error: unknown) {
  return (
    Number((error as { statusCode?: number; status?: number })?.statusCode) ||
    Number((error as { status?: number })?.status)
  );
}

export class WebsitePopupsController {
  static list = async (req: Request, res: Response) => {
    const parsed = listPopupsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const result = await websitePopupsService.list(parsed.data);
    return res.json({ success: true, ...result });
  };

  static active = async (req: Request, res: Response) => {
    const parsed = activePopupsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const result = await websitePopupsService.active(parsed.data);
    return respondWithCache(req, res, result);
  };

  static get = async (req: Request, res: Response) => {
    const popup = await websitePopupsService.get(req.params.id);
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Pop-up não encontrado' });
    }

    return res.json({ success: true, data: popup });
  };

  static create = async (req: Request, res: Response) => {
    const parsed = createPopupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const popup = await websitePopupsService.create(parsed.data, req.user?.id);
    return res.status(201).json({ success: true, data: popup });
  };

  static update = async (req: Request, res: Response) => {
    const parsed = updatePopupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      if (parsed.data.status === 'PUBLICADO') {
        const currentPopup = await websitePopupsService.get(req.params.id);
        if (!currentPopup) {
          return res.status(404).json({ success: false, message: 'Pop-up não encontrado' });
        }
      }

      const popup = await websitePopupsService.update(req.params.id, parsed.data, req.user?.id);
      return res.json({ success: true, data: popup });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar pop-up',
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      await websitePopupsService.remove(req.params.id);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover pop-up',
      });
    }
  };

  static createContact = async (req: Request, res: Response) => {
    const parsed = createPopupContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    if (!parsed.data.email && !parsed.data.telefone && !parsed.data.whatsapp) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Informe pelo menos um contato.',
      });
    }

    try {
      const contato = await websitePopupsService.createContact(req.params.id, parsed.data, {
        userId: req.user?.id,
        userAgent: req.headers['user-agent'] ?? null,
        ipHash: hashIp(getRequestIp(req)),
      });

      return res.status(201).json({ success: true, data: contato });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao registrar contato',
      });
    }
  };

  static listContacts = async (req: Request, res: Response) => {
    const parsed = popupLeadListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const result = await websitePopupsService.listContacts(parsed.data);
    return res.json({ success: true, ...result });
  };

  static getContact = async (req: Request, res: Response) => {
    try {
      const contato = await websitePopupsService.getContact(req.params.id);
      return res.json({ success: true, data: contato });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao buscar contato',
      });
    }
  };

  static getContactHistory = async (req: Request, res: Response) => {
    try {
      const history = await websitePopupsService.getContactHistory(req.params.id);
      return res.json({ success: true, history });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao carregar histórico do contato',
      });
    }
  };

  static getContactActivity = async (req: Request, res: Response) => {
    try {
      const activity = await websitePopupsService.getContactActivity(req.params.id);
      return res.json({ success: true, data: activity });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao carregar atividade do contato',
      });
    }
  };

  static updateContact = async (req: Request, res: Response) => {
    const parsed = updatePopupLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const contato = await websitePopupsService.updateContact(
        req.params.id,
        parsed.data,
        getActorContext(req),
      );
      return res.json({ success: true, data: contato });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar contato',
      });
    }
  };

  static removeContact = async (req: Request, res: Response) => {
    try {
      await websitePopupsService.removeContact(req.params.id);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover contato',
      });
    }
  };

  static createContactNote = async (req: Request, res: Response) => {
    const parsed = createPopupLeadNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const note = await websitePopupsService.createContactNote(
        req.params.id,
        parsed.data,
        req.user?.id,
      );
      return res.status(201).json({ success: true, data: note });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao criar nota',
      });
    }
  };

  static updateContactNote = async (req: Request, res: Response) => {
    const parsed = updatePopupLeadNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const note = await websitePopupsService.updateContactNote(
        req.params.id,
        req.params.noteId,
        parsed.data,
        getActorContext(req),
      );
      return res.json({ success: true, data: note });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar nota',
      });
    }
  };

  static removeContactNote = async (req: Request, res: Response) => {
    try {
      await websitePopupsService.removeContactNote(
        req.params.id,
        req.params.noteId,
        getActorContext(req),
      );
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover nota',
      });
    }
  };

  static createContactInterest = async (req: Request, res: Response) => {
    const parsed = createPopupLeadInterestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const interest = await websitePopupsService.createContactInterest(req.params.id, parsed.data);
      return res.status(201).json({ success: true, data: interest });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao criar interesse',
      });
    }
  };

  static removeContactInterest = async (req: Request, res: Response) => {
    try {
      await websitePopupsService.removeContactInterest(req.params.id, req.params.interestId);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover interesse',
      });
    }
  };

  static createContactOpportunity = async (req: Request, res: Response) => {
    const parsed = createPopupLeadOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const opportunity = await websitePopupsService.createContactOpportunity(
        req.params.id,
        parsed.data,
      );
      return res.status(201).json({ success: true, data: opportunity });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao criar oportunidade',
      });
    }
  };

  static updateContactOpportunity = async (req: Request, res: Response) => {
    const parsed = updatePopupLeadOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const opportunity = await websitePopupsService.updateContactOpportunity(
        req.params.id,
        req.params.opportunityId,
        parsed.data,
      );
      return res.json({ success: true, data: opportunity });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar oportunidade',
      });
    }
  };

  static removeContactOpportunity = async (req: Request, res: Response) => {
    try {
      await websitePopupsService.removeContactOpportunity(req.params.id, req.params.opportunityId);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover oportunidade',
      });
    }
  };
}
