import { Request, Response } from "express";
import { planoEmpresaService } from "../services/plano-empresa.service";

export class PlanoEmpresaController {
  static list = async (_req: Request, res: Response) => {
    const plans = await planoEmpresaService.list();
    res.json(plans);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plan = await planoEmpresaService.get(id);
      if (!plan) {
        return res.status(404).json({ message: "Plano não encontrado" });
      }
      res.json(plan);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao buscar plano", error: error.message });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const plan = await planoEmpresaService.create(req.body);
      res.status(201).json(plan);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar plano", error: error.message });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plan = await planoEmpresaService.update(id, req.body);
      res.json(plan);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar plano", error: error.message });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await planoEmpresaService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao remover plano", error: error.message });
    }
  };
}
