import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { consultoriaService } from "../services/consultoria.service";

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
  const fileName = `consultoria-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`consultoria/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`consultoria/${fileName}`);
  return data.publicUrl;
}

export class ConsultoriaController {
  static list = async (req: Request, res: Response) => {
    const itens = await consultoriaService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const consultoria = await consultoriaService.get(id);
      if (!consultoria) {
        return res.status(404).json({ message: "Consultoria não encontrada" });
      }
      res.json(consultoria);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao buscar consultoria", error: error.message });
    }
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
      const consultoria = await consultoriaService.create({
        imagemUrl,
        imagemTitulo,
        titulo,
        descricao,
      });
      res.status(201).json(consultoria);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao criar consultoria", error: error.message });
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
      const consultoria = await consultoriaService.update(id, data);
      res.json(consultoria);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao atualizar consultoria", error: error.message });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await consultoriaService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao remover consultoria", error: error.message });
    }
  };
}
