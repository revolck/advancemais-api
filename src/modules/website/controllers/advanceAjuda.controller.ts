import { Request, Response } from "express";
import path from "path";

import { supabase } from "@/config/supabase";
import { advanceAjudaService } from "@/modules/website/services/advanceAjuda.service";
import { respondWithCache } from "@/modules/website/utils/cache-response";

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
  const fileName = `advance-ajuda-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`advance-ajuda/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`advance-ajuda/${fileName}`);
  return data.publicUrl;
}

export class AdvanceAjudaController {
  static list = async (req: Request, res: Response) => {
    const itens = await advanceAjudaService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await advanceAjudaService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "Advance Ajuda não encontrado" });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar Advance Ajuda",
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
        descricao1,
        titulo2,
        descricao2,
        titulo3,
        descricao3,
      } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const item = await advanceAjudaService.create({
        titulo,
        descricao,
        imagemUrl,
        imagemTitulo,
        titulo1,
        descricao1,
        titulo2,
        descricao2,
        titulo3,
        descricao3,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar Advance Ajuda",
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
        descricao1,
        titulo2,
        descricao2,
        titulo3,
        descricao3,
      } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = {
        titulo,
        descricao,
        titulo1,
        descricao1,
        titulo2,
        descricao2,
        titulo3,
        descricao3,
      };
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const item = await advanceAjudaService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar Advance Ajuda",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await advanceAjudaService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover Advance Ajuda",
        error: error.message,
      });
    }
  };
}

