import { Request, Response } from "express";

import { headerPagesService } from "@/modules/website/services/header-pages.service";
import { respondWithCache } from "@/modules/website/utils/cache-response";

export class HeaderPageController {
  static list = async (_req: Request, res: Response) => {
    const items = await headerPagesService.list();
    const response = items;

    return respondWithCache(_req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await headerPagesService.get(id);
      if (!item) {
        return res.status(404).json({ message: "Header page não encontrado" });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Erro ao buscar header page", error: error.message });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const {
        subtitulo,
        titulo,
        descricao,
        imagemUrl: rawImagemUrl,
        buttonLabel,
        buttonLink: rawButtonLink,
        page,
      } = req.body;
      const imagemUrl =
        typeof rawImagemUrl === "string" ? rawImagemUrl.trim() : "";
      const buttonLink =
        typeof rawButtonLink === "string" ? rawButtonLink.trim() : "";
      const item = await headerPagesService.create({
        subtitulo,
        titulo,
        descricao,
        imagemUrl,
        buttonLabel,
        buttonLink,
        page,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar header page",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        subtitulo,
        titulo,
        descricao,
        imagemUrl: rawImagemUrl,
        buttonLabel,
        buttonLink: rawButtonLink,
        page,
      } = req.body;
      const data: any = {};
      if (subtitulo !== undefined) data.subtitulo = subtitulo;
      if (titulo !== undefined) data.titulo = titulo;
      if (descricao !== undefined) data.descricao = descricao;
      if (buttonLabel !== undefined) data.buttonLabel = buttonLabel;
      if (page !== undefined) data.page = page;
      if (rawImagemUrl !== undefined)
        data.imagemUrl = (rawImagemUrl as string).trim();
      if (rawButtonLink !== undefined)
        data.buttonLink = (rawButtonLink as string).trim();
      const item = await headerPagesService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar header page",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await headerPagesService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover header page",
        error: error.message,
      });
    }
  };
}
