import { Request, Response } from 'express';

import { informacoesGeraisService } from '@/modules/website/services/informacoes-gerais.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

export class InformacoesGeraisController {
  static list = async (req: Request, res: Response) => {
    const itens = await informacoesGeraisService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const info = await informacoesGeraisService.get(id);
      if (!info) {
        return res.status(404).json({ message: 'Informação não encontrada' });
      }
      const response = info;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar informação',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { horarios = [], ...data } = req.body;
      const info = await informacoesGeraisService.create({
        ...data,
        WebsiteHorarioFuncionamento: { create: horarios },
      });
      res.status(201).json(info);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar informação',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { horarios, ...data } = req.body;
      const info = await informacoesGeraisService.update(id, {
        ...data,
        ...(horarios && {
          WebsiteHorarioFuncionamento: { deleteMany: {}, create: horarios },
        }),
      });
      res.json(info);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar informação',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await informacoesGeraisService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover informação',
        error: error.message,
      });
    }
  };
}
