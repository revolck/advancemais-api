import { Request, Response } from "express";
import { setCacheHeaders } from '../../../utils/cache';
import { sobreEmpresaService } from "../services/sobreEmpresa.service";

export class SobreEmpresaController {
  static list = async (req: Request, res: Response) => {
    const itens = await sobreEmpresaService.list();
    const response = itens;

    setCacheHeaders(res, response);

    res.json(response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sobreEmpresa = await sobreEmpresaService.get(id);
      if (!sobreEmpresa) {
        return res
          .status(404)
          .json({ message: "SobreEmpresa não encontrado" });
      }
      const response = sobreEmpresa;

      setCacheHeaders(res, response);

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar sobreEmpresa",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        titulo,
        descricao,
        descricaoVisao,
        descricaoMissao,
        descricaoValores,
        videoUrl,
      } = req.body;
      const sobreEmpresa = await sobreEmpresaService.create({
        titulo,
        descricao,
        descricaoVisao,
        descricaoMissao,
        descricaoValores,
        videoUrl,
      });
      res.status(201).json(sobreEmpresa);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar sobreEmpresa",
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
        descricaoVisao,
        descricaoMissao,
        descricaoValores,
        videoUrl,
      } = req.body;
      const sobreEmpresa = await sobreEmpresaService.update(id, {
        titulo,
        descricao,
        descricaoVisao,
        descricaoMissao,
        descricaoValores,
        videoUrl,
      });
      res.json(sobreEmpresa);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar sobreEmpresa",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await sobreEmpresaService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover sobreEmpresa",
        error: error.message,
      });
    }
  };
}

