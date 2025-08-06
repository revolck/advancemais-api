import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { businessGroupInformationService } from "../services/businessGroupInformation.service";

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
  const fileName = `business-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`business/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`business/${fileName}`);
  return data.publicUrl;
}

export class BusinessGroupInformationController {
  static list = async (req: Request, res: Response) => {
    const itens = await businessGroupInformationService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await businessGroupInformationService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "Informação de grupo não encontrada" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar informação de grupo",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        slug,
        titulo,
        descricao,
        botaoLabel,
        botaoUrl,
        reverse,
        ordem,
        ativo,
        imagemAlt,
      } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const alt = imagemAlt || (imagemUrl ? generateImageTitle(imagemUrl) : "");
      const item = await businessGroupInformationService.create({
        slug,
        titulo,
        descricao,
        botaoLabel,
        botaoUrl,
        imagemUrl,
        imagemAlt: alt,
        reverse: reverse === "true" || reverse === true,
        ordem: ordem ? parseInt(ordem, 10) : 0,
        ativo: ativo === undefined ? true : ativo === "true" || ativo === true,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar informação de grupo",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        slug,
        titulo,
        descricao,
        botaoLabel,
        botaoUrl,
        reverse,
        ordem,
        ativo,
        imagemAlt,
      } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = {
        slug,
        titulo,
        descricao,
        botaoLabel,
        botaoUrl,
        imagemAlt,
      };
      if (reverse !== undefined) {
        data.reverse = reverse === "true" || reverse === true;
      }
      if (ordem !== undefined) {
        data.ordem = parseInt(ordem, 10);
      }
      if (ativo !== undefined) {
        data.ativo = ativo === "true" || ativo === true;
      }
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        if (!imagemAlt) {
          data.imagemAlt = generateImageTitle(imagemUrl);
        }
      }
      const item = await businessGroupInformationService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar informação de grupo",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await businessGroupInformationService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover informação de grupo",
        error: error.message,
      });
    }
  };
}
