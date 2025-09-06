import { Request, Response } from "express";
import { informacoesGeraisService } from "../services/informacoes-gerais.service";

export class InformacoesGeraisController {
  static list = async (req: Request, res: Response) => {
    const itens = await informacoesGeraisService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const info = await informacoesGeraisService.get(id);
      if (!info) {
        return res.status(404).json({ message: "Informação não encontrada" });
      }
      res.json(info);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar informação",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const info = await informacoesGeraisService.create(req.body);
      res.status(201).json(info);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar informação",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const info = await informacoesGeraisService.update(id, req.body);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar informação",
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
        message: "Erro ao remover informação",
        error: error.message,
      });
    }
  };
}
