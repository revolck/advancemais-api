import { Request, Response } from "express";
import { vagaService } from "../services/vaga.service";

export class VagaController {
  static create = async (req: Request, res: Response) => {
    try {
      const vaga = await vagaService.create(req.body);
      res.status(201).json(vaga);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  static list = async (_req: Request, res: Response) => {
    const vagas = await vagaService.list();
    res.json(vagas);
  };

  static apply = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      if (req.user?.role !== "ALUNO_CANDIDATO") {
        return res
          .status(403)
          .json({ message: "Somente alunos candidatos podem se candidatar" });
      }
      const { id } = req.params;
      const candidatura = await vagaService.apply(
        id,
        usuarioId,
        req.body.curriculoUrl
      );
      res.status(201).json(candidatura);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}
