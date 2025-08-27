import { Request, Response } from "express";
import path from "path";
import { sobreService } from "../services/sobre.service";

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split(".")[0];
  } catch {
    return "";
  }
}


export class SobreController {
  static list = async (req: Request, res: Response) => {
    const itens = await sobreService.list();
    res.json(itens);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sobre = await sobreService.get(id);
      if (!sobre) {
        return res.status(404).json({ message: "Sobre não encontrado" });
      }
      res.json(sobre);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao buscar sobre", error: error.message });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao } = req.body;
      const imagemUrlRaw = req.body.imagemUrl;
      const imagemUrl =
        typeof imagemUrlRaw === "string" ? imagemUrlRaw.trim() : undefined;
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const sobre = await sobreService.create({
        imagemUrl: imagemUrl ?? "",
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
      const imagemUrlRaw = req.body.imagemUrl;
      const imagemUrl =
        typeof imagemUrlRaw === "string" ? imagemUrlRaw.trim() : undefined;
      const data: any = {};
      if (titulo !== undefined) data.titulo = titulo;
      if (descricao !== undefined) data.descricao = descricao;
      if (imagemUrl !== undefined) {
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
