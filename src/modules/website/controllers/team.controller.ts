import { Request, Response } from "express";
import { WebsiteStatus } from "@prisma/client";
import { teamService } from "../services/team.service";

export class TeamController {
  static list = async (req: Request, res: Response) => {
    let { status } = req.query as any;
    if (typeof status === "string") {
      if (status === "true") status = "PUBLICADO";
      else if (status === "false") status = "RASCUNHO";
      else status = status.toUpperCase();
    }
    const itens = await teamService.list(status as WebsiteStatus | undefined);
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
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      const team = await teamService.create({
        photoUrl,
        nome,
        cargo,
        status: status as WebsiteStatus,
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
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      const data: any = { nome, cargo };
      if (photoUrl) {
        data.photoUrl = photoUrl;
      }
      if (status !== undefined) data.status = status as WebsiteStatus;
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
