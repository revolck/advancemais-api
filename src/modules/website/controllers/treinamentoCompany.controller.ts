import { Request, Response } from "express";
import { treinamentoCompanyService } from "../services/treinamentoCompany.service";

export class TreinamentoCompanyController {
  static list = async (req: Request, res: Response) => {
    const itens = await treinamentoCompanyService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await treinamentoCompanyService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "TreinamentoCompany não encontrado" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        titulo,
        icone1,
        descricao1,
        icone2,
        descricao2,
        icone3,
        descricao3,
        icone4,
        descricao4,
        icone5,
        descricao5,
      } = req.body;
      const item = await treinamentoCompanyService.create({
        titulo,
        icone1,
        descricao1,
        icone2,
        descricao2,
        icone3,
        descricao3,
        icone4,
        descricao4,
        icone5,
        descricao5,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        titulo,
        icone1,
        descricao1,
        icone2,
        descricao2,
        icone3,
        descricao3,
        icone4,
        descricao4,
        icone5,
        descricao5,
      } = req.body;
      const item = await treinamentoCompanyService.update(id, {
        titulo,
        icone1,
        descricao1,
        icone2,
        descricao2,
        icone3,
        descricao3,
        icone4,
        descricao4,
        icone5,
        descricao5,
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await treinamentoCompanyService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover TreinamentoCompany",
        error: error.message,
      });
    }
  };
}

