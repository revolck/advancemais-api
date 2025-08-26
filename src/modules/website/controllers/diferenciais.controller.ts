import { Request, Response } from "express";
import { diferenciaisService } from "../services/diferenciais.service";

export class DiferenciaisController {
  static list = async (req: Request, res: Response) => {
    const itens = await diferenciaisService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const diferencial = await diferenciaisService.get(id);
      if (!diferencial) {
        return res
          .status(404)
          .json({ message: "Diferenciais não encontrado" });
      }
      res.json(diferencial);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar diferenciais",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
        icone4,
        titulo4,
        descricao4,
        titulo,
        descricao,
        botaoUrl,
        botaoLabel,
      } = req.body;
      const diferencial = await diferenciaisService.create({
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
        icone4,
        titulo4,
        descricao4,
        titulo,
        descricao,
        botaoUrl,
        botaoLabel,
      });
      res.status(201).json(diferencial);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar diferenciais",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
        icone4,
        titulo4,
        descricao4,
        titulo,
        descricao,
        botaoUrl,
        botaoLabel,
      } = req.body;
      const diferencial = await diferenciaisService.update(id, {
        icone1,
        titulo1,
        descricao1,
        icone2,
        titulo2,
        descricao2,
        icone3,
        titulo3,
        descricao3,
        icone4,
        titulo4,
        descricao4,
        titulo,
        descricao,
        botaoUrl,
        botaoLabel,
      });
      res.json(diferencial);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar diferenciais",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await diferenciaisService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover diferenciais",
        error: error.message,
      });
    }
  };
}
