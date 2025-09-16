import { Request, Response } from 'express';

import { sistemaService } from '@/modules/website/services/sistema.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

export class SistemaController {
  static list = async (req: Request, res: Response) => {
    const itens = await sistemaService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await sistemaService.get(id);
      if (!item) {
        return res.status(404).json({ message: 'Sistema não encontrado' });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar sistema',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        titulo,
        descricao,
        subtitulo,
        etapa1Titulo,
        etapa1Descricao,
        etapa2Titulo,
        etapa2Descricao,
        etapa3Titulo,
        etapa3Descricao,
      } = req.body;
      const item = await sistemaService.create({
        titulo,
        descricao,
        subtitulo,
        etapa1Titulo,
        etapa1Descricao,
        etapa2Titulo,
        etapa2Descricao,
        etapa3Titulo,
        etapa3Descricao,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar sistema',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        titulo,
        descricao,
        subtitulo,
        etapa1Titulo,
        etapa1Descricao,
        etapa2Titulo,
        etapa2Descricao,
        etapa3Titulo,
        etapa3Descricao,
      } = req.body;
      const item = await sistemaService.update(id, {
        titulo,
        descricao,
        subtitulo,
        etapa1Titulo,
        etapa1Descricao,
        etapa2Titulo,
        etapa2Descricao,
        etapa3Titulo,
        etapa3Descricao,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar sistema',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await sistemaService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover sistema',
        error: error.message,
      });
    }
  };
}
