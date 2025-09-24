import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { cuponsService, CupomNaoEncontradoError } from '@/modules/cupons/services/cupons.service';
import {
  createCupomDescontoSchema,
  updateCupomDescontoSchema,
  CreateCupomDescontoInput,
  UpdateCupomDescontoInput,
} from '@/modules/cupons/validators/cupons.schema';

export class CuponsController {
  static list = async (_req: Request, res: Response) => {
    try {
      const cupons = await cuponsService.list();
      res.json(cupons);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CUPONS_LIST_ERROR',
        message: 'Erro ao listar cupons de desconto',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cupom = await cuponsService.get(id);

      if (!cupom) {
        return res.status(404).json({
          success: false,
          code: 'CUPOM_NOT_FOUND',
          message: 'Cupom de desconto não encontrado',
        });
      }

      res.json(cupom);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CUPOM_GET_ERROR',
        message: 'Erro ao buscar cupom de desconto',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const payload = createCupomDescontoSchema.parse(req.body) as CreateCupomDescontoInput;
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        return res.status(403).json({
          success: false,
          code: 'CUPOM_CREATE_FORBIDDEN',
          message: 'Usuário não autorizado a criar cupons',
        });
      }

      const cupom = await cuponsService.create(payload, usuarioId);
      res.status(201).json(cupom);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do cupom de desconto',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          code: 'CUPOM_DUPLICATE_CODE',
          message: 'Já existe um cupom cadastrado com este código',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CUPOM_CREATE_ERROR',
        message: 'Erro ao criar cupom de desconto',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateCupomDescontoSchema.parse(req.body) as UpdateCupomDescontoInput;

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do cupom de desconto',
        });
      }

      const cupom = await cuponsService.update(id, payload);
      res.json(cupom);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do cupom de desconto',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof CupomNaoEncontradoError) {
        return res.status(404).json({
          success: false,
          code: 'CUPOM_NOT_FOUND',
          message: error.message,
        });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          code: 'CUPOM_DUPLICATE_CODE',
          message: 'Já existe um cupom cadastrado com este código',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CUPOM_UPDATE_ERROR',
        message: 'Erro ao atualizar cupom de desconto',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await cuponsService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CUPOM_NOT_FOUND',
          message: 'Cupom de desconto não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CUPOM_DELETE_ERROR',
        message: 'Erro ao remover cupom de desconto',
        error: error?.message,
      });
    }
  };
}
