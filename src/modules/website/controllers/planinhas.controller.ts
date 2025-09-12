import { Request, Response } from "express";
import { setCacheHeaders } from '../../../utils/cache';
import { planinhasService } from "../services/planinhas.service";

export class PlaninhasController {
  static list = async (req: Request, res: Response) => {
    const itens = await planinhasService.list();
    const response = itens;

    setCacheHeaders(res, response);

    res.json(response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await planinhasService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "Planinhas não encontrado" });
      }
      const response = item;

      setCacheHeaders(res, response);

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar planinhas",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        titulo,
        descricao,
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
      } = req.body;

      const item = await planinhasService.create({
        titulo,
        descricao,
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
      });

      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar planinhas",
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
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
      } = req.body;

      const item = await planinhasService.update(id, {
        titulo,
        descricao,
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
      });

      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar planinhas",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await planinhasService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover planinhas",
        error: error.message,
      });
    }
  };
}

