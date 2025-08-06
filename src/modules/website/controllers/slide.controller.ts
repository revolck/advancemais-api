import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { slideService } from "../services/slide.service";

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
  const fileName = `slide-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`slides/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`slides/${fileName}`);
  return data.publicUrl;
}

export class SlideController {
  static list = async (req: Request, res: Response) => {
    const itens = await slideService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const slide = await slideService.get(id);
      if (!slide) {
        return res.status(404).json({ message: "Slide não encontrado" });
      }
      res.json(slide);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar slide",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { link, ordem } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const slide = await slideService.create({
        imagemUrl,
        imagemTitulo,
        link,
        ordem: ordem ? parseInt(ordem, 10) : 0,
      });
      res.status(201).json(slide);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar slide",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { link, ordem } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = { link };
      if (ordem !== undefined) {
        data.ordem = parseInt(ordem, 10);
      }
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const slide = await slideService.update(id, data);
      res.json(slide);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar slide",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await slideService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover slide",
        error: error.message,
      });
    }
  };
}

