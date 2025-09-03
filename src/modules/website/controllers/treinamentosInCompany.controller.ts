import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { treinamentosInCompanyService } from "../services/treinamentosInCompany.service";

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split(".")[0];
  } catch {
    return "";
  }
}

async function uploadImage(file: Express.Multer.File): Promise<string> {
  const fileExt = path.extname(file.originalname);
  const fileName = `treinamentos-in-company-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`treinamentos-in-company/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`treinamentos-in-company/${fileName}`);
  return data.publicUrl;
}

export class TreinamentosInCompanyController {
  static list = async (req: Request, res: Response) => {
    const itens = await treinamentosInCompanyService.list();
    res.json(itens);
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
      res.json(item);
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
        descricao,
        titulo1,
        titulo2,
        titulo3,
        titulo4,
      } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const item = await treinamentosInCompanyService.create({
        titulo,
        descricao,
        imagemUrl,
        imagemTitulo,
        titulo1,
        titulo2,
        titulo3,
        titulo4,
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
        descricao,
        titulo1,
        titulo2,
        titulo3,
        titulo4,
      } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = {
        titulo,
        descricao,
        titulo1,
        titulo2,
        titulo3,
        titulo4,
      };
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const item = await treinamentosInCompanyService.update(id, data);
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

