import { Request, Response } from "express";
import path from "path";
import { WebsiteStatus } from "@prisma/client";

import { supabase } from "@/config/supabase";
import { bannerService } from "@/modules/website/services/banner.service";
import { respondWithCache } from "@/modules/website/utils/cache-response";

function mapBanner(ordem: any) {
  return {
    id: ordem.id,
    bannerId: ordem.banner.id,
    imagemUrl: ordem.banner.imagemUrl,
    imagemTitulo: ordem.banner.imagemTitulo,
    link: ordem.banner.link,
    criadoEm: ordem.banner.criadoEm,
    atualizadoEm: ordem.banner.atualizadoEm,
    ordem: ordem.ordem,
    status: ordem.status,
    ordemCriadoEm: ordem.criadoEm,
  };
}

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
  const fileName = `banner-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from("website")
    .upload(`banners/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from("website")
    .getPublicUrl(`banners/${fileName}`);
  return data.publicUrl;
}

export class BannerController {
  static list = async (req: Request, res: Response) => {
    const itens = await bannerService.list();
    const response = itens.map(mapBanner);

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const ordem = await bannerService.get(ordemId);
      if (!ordem) {
        return res.status(404).json({ message: "Banner não encontrado" });
      }
      const response = mapBanner(ordem);

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar banner",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { link } = req.body;
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      let imagemUrl = "";
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : "";
      const ordem = await bannerService.create({
        imagemUrl,
        imagemTitulo,
        link,
        status,
      });
      res.status(201).json(mapBanner(ordem));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar banner",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id: bannerId } = req.params;
      const { link, ordem } = req.body;
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = { link };
      if (status !== undefined) data.status = status as WebsiteStatus;
      if (ordem !== undefined) {
        data.ordem = parseInt(ordem, 10);
      }
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const ordemResult = await bannerService.update(bannerId, data);
      res.json(mapBanner(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar banner",
        error: error.message,
      });
    }
  };

  static reorder = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const { ordem } = req.body;
      const ordemResult = await bannerService.reorder(ordemId, parseInt(ordem, 10));
      res.json(mapBanner(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao reordenar banner",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id: bannerId } = req.params;
      await bannerService.remove(bannerId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover banner",
        error: error.message,
      });
    }
  };
}
