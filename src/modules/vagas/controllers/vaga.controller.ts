import { Request, Response } from "express";
import { vagaService } from "../services/vaga.service";

export class VagaController {
  static list = async (req: Request, res: Response) => {
    const empresaId = req.query.empresaId as string | undefined;
    const vagas = await vagaService.list(empresaId);
    res.json(vagas);
  };

  static get = async (req: Request, res: Response) => {
    const { id } = req.params;
    const vaga = await vagaService.get(id);
    if (!vaga) return res.status(404).json({ message: "Vaga não encontrada" });
    res.json(vaga);
  };

  static create = async (req: Request, res: Response) => {
    try {
      const vaga = await vagaService.create(req.body);
      res.status(201).json(vaga);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  static update = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const vaga = await vagaService.update(id, req.body);
      res.json(vaga);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  static remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    await vagaService.remove(id);
    res.status(204).send();
  };

  static apply = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { usuarioId } = req.body;
    await vagaService.apply(id, usuarioId);
    res.status(201).json({ success: true });
  };
}
