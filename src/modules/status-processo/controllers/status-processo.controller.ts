import { Request, Response } from 'express';
import { StatusProcessoService } from '../services/status-processo.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const statusProcessoService = new StatusProcessoService(prisma);

export class StatusProcessoController {
  async list(req: Request, res: Response) {
    try {
      const filters = (req as any).validatedData;
      const result = await statusProcessoService.list(filters);

      res.json({
        success: true,
        message: 'Lista de status de processo retornada com sucesso',
        data: {
          statusProcessos: result.data,
          pagination: result.pagination,
        },
        correlationId: (req as any).id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erro ao listar status de processo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao listar status de processo',
        code: 'LIST_STATUS_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        correlationId: (req as any).id,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = (req as any).validatedData;
      const status = await statusProcessoService.getById(id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Status não encontrado.') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = (req as any).validatedData;
      const criadoPor = (req as any).user?.id;

      if (!criadoPor) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.',
        });
      }

      const status = await statusProcessoService.create(data, criadoPor);

      const message = data.isDefault
        ? 'Status criado com sucesso e definido como padrão. O status padrão anterior foi desativado.'
        : 'Status criado com sucesso.';

      res.status(201).json({
        success: true,
        message,
        data: status,
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id, ...data } = (req as any).validatedData;
      const status = await statusProcessoService.update(id, data);

      const message = data.isDefault
        ? 'Status atualizado com sucesso e definido como padrão. O status padrão anterior foi desativado.'
        : 'Status atualizado com sucesso.';

      res.json({
        success: true,
        message,
        data: status,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Status não encontrado.') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).validatedData;
      await statusProcessoService.delete(id);

      res.json({
        success: true,
        message: 'Status removido com sucesso.',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Status não encontrado.') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('não é possível remover')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }

  async getDefault(req: Request, res: Response) {
    try {
      const status = await statusProcessoService.getDefault();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Nenhum status padrão encontrado.') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }

  async getAllActive(req: Request, res: Response) {
    try {
      const status = await statusProcessoService.getAllActive();

      res.json({
        success: true,
        data: status,
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor.',
      });
    }
  }
}
