import { Request, Response } from 'express';
import path from 'path';

import { uploadImage } from '@/config/storage';
import { imagemLoginService } from '@/modules/website/services/imagem-login.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split('.')[0];
  } catch {
    return '';
  }
}

async function uploadLoginImage(file: Express.Multer.File): Promise<string> {
  return uploadImage('website', 'login', file);
}

export class ImagemLoginController {
  static list = async (req: Request, res: Response) => {
    const itens = await imagemLoginService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await imagemLoginService.get(id);
      if (!item) {
        return res.status(404).json({ message: 'Imagem de login não encontrada' });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar imagem de login',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { link } = req.body;
      let imagemUrl = '';
      if (req.file) {
        imagemUrl = await uploadLoginImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : '';
      const item = await imagemLoginService.create({
        imagemUrl,
        imagemTitulo,
        link,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar imagem de login',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { link } = req.body;
      let imagemUrl: string | undefined = req.body.imagemUrl;
      if (req.file) {
        imagemUrl = await uploadLoginImage(req.file);
      }
      const data: any = { link };
      if (imagemUrl !== undefined) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const item = await imagemLoginService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar imagem de login',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await imagemLoginService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover imagem de login',
        error: error.message,
      });
    }
  };
}
