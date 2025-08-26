import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { teamService } from "../services/team.service";

async function uploadImage(file: Express.Multer.File): Promise<string> {
  const fileExt = path.extname(file.originalname);
  const fileName = `team-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`team/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`team/${fileName}`);
  return data.publicUrl;
}

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
      const { nome, cargo } = req.body;
      let photoUrl = "";
      if (req.file) {
        photoUrl = await uploadImage(req.file);
      } else if (req.body.photoUrl) {
        photoUrl = req.body.photoUrl;
      }
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
      const { nome, cargo } = req.body;
      let photoUrl = req.body.photoUrl as string | undefined;
      if (req.file) {
        photoUrl = await uploadImage(req.file);
      }
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
