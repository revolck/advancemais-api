import { Request, Response } from "express";
import { setCacheHeaders } from '../../../utils/cache';
import { treinamentosInCompanyService } from "../services/treinamentosInCompany.service";

export class TreinamentosInCompanyController {
  static list = async (req: Request, res: Response) => {
    const itens = await treinamentosInCompanyService.list();
    const response = itens;

    setCacheHeaders(res, response);

    res.json(response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await treinamentosInCompanyService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "TreinamentosInCompany não encontrado" });
      }
      const response = item;

      setCacheHeaders(res, response);

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar TreinamentosInCompany",
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

      const item = await treinamentosInCompanyService.create({
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
        message: "Erro ao criar TreinamentosInCompany",
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

      const item = await treinamentosInCompanyService.update(id, {
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
        message: "Erro ao atualizar TreinamentosInCompany",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await treinamentosInCompanyService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover TreinamentosInCompany",
        error: error.message,
      });
    }
  };
}

