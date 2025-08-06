import { Request, Response } from "express";
import path from "path";
import { supabase } from "../../superbase/client";
import { logoEnterpriseService } from "../services/logoEnterprise.service";

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
  const fileName = `logo-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`logos/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`logos/${fileName}`);
  return data.publicUrl;
}

export class LogoEnterpriseController {
  static list = async (req: Request, res: Response) => {
    const itens = await logoEnterpriseService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await logoEnterpriseService.get(id);
      if (!item) {
        return res.status(404).json({ message: "Logo não encontrado" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar logo",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { nome, website, categoria, ordem, ativo, imagemAlt } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const alt = imagemAlt || (imagemUrl ? generateImageTitle(imagemUrl) : "");
      const item = await logoEnterpriseService.create({
        nome,
        imagemUrl,
        imagemAlt: alt,
        website,
        categoria,
        ordem: ordem ? parseInt(ordem, 10) : 0,
        ativo: ativo === undefined ? true : ativo === "true" || ativo === true,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar logo",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nome, website, categoria, ordem, ativo, imagemAlt } = req.body;
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = { nome, website, categoria, imagemAlt };
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
      const item = await logoEnterpriseService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar logo",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await logoEnterpriseService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover logo",
        error: error.message,
      });
    }
  };
}
