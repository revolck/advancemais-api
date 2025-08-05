import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { sobreService } from "../services/sobre.service";

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
  const fileName = `sobre-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`sobre/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`sobre/${fileName}`);
  return data.publicUrl;
}

export class SobreController {
  static list = async (req: Request, res: Response) => {
    const itens = await sobreService.list();
    res.json(itens);
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const sobre = await sobreService.create({
        imagemUrl,
        imagemTitulo,
        titulo,
        descricao,
      });
      res.status(201).json(sobre);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao criar sobre", error: error.message });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { titulo, descricao } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = { titulo, descricao };
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const sobre = await sobreService.update(id, data);
      res.json(sobre);
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao atualizar sobre", error: error.message });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await sobreService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: "Erro ao remover sobre", error: error.message });
    }
  };
}
