import { Request, Response } from "express";
import { setCacheHeaders } from '../../../utils/cache';
import path from "path";
import { supabase } from "../../superbase/client";
import { treinamentoCompanyService } from "../services/treinamentoCompany.service";

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
  const fileName = `treinamento-company-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`treinamento-company/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`treinamento-company/${fileName}`);
  return data.publicUrl;
}

export class TreinamentoCompanyController {
  static list = async (req: Request, res: Response) => {
    const itens = await treinamentoCompanyService.list();
    const response = itens;

    setCacheHeaders(res, response);

    res.json(response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await treinamentoCompanyService.get(id);
      if (!item) {
        return res
          .status(404)
          .json({ message: "TreinamentoCompany não encontrado" });
      }
      const response = item;

      setCacheHeaders(res, response);

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao, titulo1, titulo2, titulo3, titulo4 } = req.body;
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const item = await treinamentoCompanyService.create({
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
        message: "Erro ao criar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { titulo, descricao, titulo1, titulo2, titulo3, titulo4 } = req.body;
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
      const item = await treinamentoCompanyService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar TreinamentoCompany",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await treinamentoCompanyService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover TreinamentoCompany",
        error: error.message,
      });
    }
  };
}

