import { Request, Response } from 'express';

import { websiteEmailsMarketingService } from '@/modules/website/services/emails-marketing.service';
import {
  createMarketingEmailSchema,
  listMarketingEmailsQuerySchema,
  updateMarketingEmailSchema,
} from '@/modules/website/validators/emails-marketing.schema';

function formatValidationError(error: unknown) {
  if (error && typeof error === 'object' && 'flatten' in error) {
    return (error as { flatten: () => unknown }).flatten();
  }
  return error;
}

function getErrorStatus(error: unknown) {
  return (
    Number((error as { statusCode?: number; status?: number })?.statusCode) ||
    Number((error as { status?: number })?.status)
  );
}

export class WebsiteEmailsMarketingController {
  static recipientOptions = async (_req: Request, res: Response) => {
    const data = await websiteEmailsMarketingService.getRecipientOptions();
    return res.json({ success: true, data });
  };

  static filterOptions = async (_req: Request, res: Response) => {
    const data = await websiteEmailsMarketingService.getFilterOptions();
    return res.json({ success: true, data });
  };

  static list = async (req: Request, res: Response) => {
    const parsed = listMarketingEmailsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const result = await websiteEmailsMarketingService.list(parsed.data);
    return res.json({ success: true, ...result });
  };

  static get = async (req: Request, res: Response) => {
    const email = await websiteEmailsMarketingService.get(req.params.id);
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Campanha de e-mail não encontrada',
      });
    }

    return res.json({ success: true, data: email });
  };

  static create = async (req: Request, res: Response) => {
    const parsed = createMarketingEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const email = await websiteEmailsMarketingService.create(parsed.data, req.user?.id ?? null);
    return res.status(201).json({ success: true, data: email });
  };

  static update = async (req: Request, res: Response) => {
    const parsed = updateMarketingEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const email = await websiteEmailsMarketingService.update(
        req.params.id,
        parsed.data,
        req.user?.id ?? null,
      );
      return res.json({ success: true, data: email });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar campanha de e-mail',
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      await websiteEmailsMarketingService.remove(req.params.id);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover campanha de e-mail',
      });
    }
  };
}
