import { Request, Response } from "express";
import { teamService } from "../services/team.service";

export class TeamController {
  static list = async (req: Request, res: Response) => {
    const itens = await teamService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const team = await teamService.get(id);
      if (!team) {
        return res.status(404).json({ message: "Team member não encontrado" });
      }
      res.json(team);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar team member",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { nome, cargo, photoUrl } = req.body;
      const team = await teamService.create({
        photoUrl,
        nome,
        cargo,
      });
      res.status(201).json(team);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar team member",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nome, cargo, photoUrl } = req.body;
      const data: any = { nome, cargo };
      if (photoUrl) {
        data.photoUrl = photoUrl;
      }
      const team = await teamService.update(id, data);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar team member",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await teamService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover team member",
        error: error.message,
      });
    }
  };
}
