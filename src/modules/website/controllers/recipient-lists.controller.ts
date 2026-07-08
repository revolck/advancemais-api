import { Request, Response } from 'express';

import { websiteRecipientListsService } from '@/modules/website/services/recipient-lists.service';
import {
  createRecipientListFolderSchema,
  createRecipientListSchema,
  listRecipientListFoldersQuerySchema,
  listRecipientListsQuerySchema,
  recipientListStatusesQuerySchema,
  recipientListRecipientsOptionsQuerySchema,
  updateRecipientListFolderSchema,
  updateRecipientListSchema,
} from '@/modules/website/validators/recipient-lists.schema';

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

export class WebsiteRecipientListsController {
  static list = async (req: Request, res: Response) => {
    const parsed = listRecipientListsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const result = await websiteRecipientListsService.list(parsed.data);
    return res.json({ success: true, ...result });
  };

  static get = async (req: Request, res: Response) => {
    const list = await websiteRecipientListsService.get(req.params.id);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'Lista não encontrada',
      });
    }

    return res.json({ success: true, data: list });
  };

  static statuses = async (req: Request, res: Response) => {
    const parsed = recipientListStatusesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const data = await websiteRecipientListsService.listStatuses(parsed.data);
    return res.json({ success: true, data });
  };

  static create = async (req: Request, res: Response) => {
    const parsed = createRecipientListSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const list = await websiteRecipientListsService.create(parsed.data, req.user?.id ?? null);
    return res.status(201).json({ success: true, data: list });
  };

  static update = async (req: Request, res: Response) => {
    const parsed = updateRecipientListSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const list = await websiteRecipientListsService.update(
        req.params.id,
        parsed.data,
        req.user?.id ?? null,
      );
      return res.json({ success: true, data: list });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar lista',
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      await websiteRecipientListsService.remove(req.params.id);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover lista',
      });
    }
  };

  static recalculate = async (req: Request, res: Response) => {
    try {
      const list = await websiteRecipientListsService.recalculate(
        req.params.id,
        req.user?.id ?? null,
      );
      return res.json({ success: true, data: list });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao recalcular lista',
      });
    }
  };

  static rulesOptions = async (_req: Request, res: Response) => {
    const data = await websiteRecipientListsService.getRuleOptions();
    return res.json({ success: true, data });
  };

  static recipientsOptions = async (req: Request, res: Response) => {
    const parsed = recipientListRecipientsOptionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const data = await websiteRecipientListsService.getRecipientsOptions(parsed.data);
    return res.json({ success: true, data });
  };

  static listFolders = async (req: Request, res: Response) => {
    const parsed = listRecipientListFoldersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const folders = await websiteRecipientListsService.listFolders(parsed.data);
    return res.json({ success: true, folders });
  };

  static createFolder = async (req: Request, res: Response) => {
    const parsed = createRecipientListFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    const folder = await websiteRecipientListsService.createFolder(
      parsed.data,
      req.user?.id ?? null,
    );
    return res.status(201).json({ success: true, data: folder });
  };

  static updateFolder = async (req: Request, res: Response) => {
    const parsed = updateRecipientListFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: formatValidationError(parsed.error),
      });
    }

    try {
      const folder = await websiteRecipientListsService.updateFolder(
        req.params.id,
        parsed.data,
        req.user?.id ?? null,
      );
      return res.json({ success: true, data: folder });
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar pasta',
      });
    }
  };

  static removeFolder = async (req: Request, res: Response) => {
    try {
      await websiteRecipientListsService.removeFolder(req.params.id);
      return res.status(204).send();
    } catch (error) {
      const status = getErrorStatus(error) || 500;
      return res.status(status === 0 ? 500 : status).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover pasta',
      });
    }
  };
}
