import { Request, Response } from 'express';
import path from 'path';

import { supabase } from '@/config/supabase';
import { conexaoForteService } from '@/modules/website/services/conexaoForte.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split('.')[0];
  } catch {
    return '';
  }
}

async function uploadImage(file: Express.Multer.File, index: number): Promise<string> {
  const fileExt = path.extname(file.originalname);
  const fileName = `conexao-forte-${index}-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from('website')
    .upload(`conexao-forte/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage.from('website').getPublicUrl(`conexao-forte/${fileName}`);
  return data.publicUrl;
}

export class ConexaoForteController {
  static list = async (req: Request, res: Response) => {
    const itens = await conexaoForteService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await conexaoForteService.get(id);
      if (!item) {
        return res.status(404).json({ message: 'ConexaoForte não encontrado' });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar ConexaoForte',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao } = req.body;
      const files = req.files as Record<string, Express.Multer.File[]>;
      const data: any = { titulo, descricao };

      for (let i = 1; i <= 4; i++) {
        const file = files?.[`imagem${i}`]?.[0];
        let url = req.body[`imagemUrl${i}`];
        if (file) {
          url = await uploadImage(file, i);
        }
        if (url) {
          data[`imagemUrl${i}`] = url;
          data[`imagemTitulo${i}`] = generateImageTitle(url);
        }
      }

      const item = await conexaoForteService.create(data);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar ConexaoForte',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { titulo, descricao } = req.body;
      const files = req.files as Record<string, Express.Multer.File[]>;
      const data: any = { titulo, descricao };

      for (let i = 1; i <= 4; i++) {
        const file = files?.[`imagem${i}`]?.[0];
        let url = req.body[`imagemUrl${i}`];
        if (file) {
          url = await uploadImage(file, i);
        }
        if (url) {
          data[`imagemUrl${i}`] = url;
          data[`imagemTitulo${i}`] = generateImageTitle(url);
        }
      }

      const item = await conexaoForteService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar ConexaoForte',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await conexaoForteService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover ConexaoForte',
        error: error.message,
      });
    }
  };
}
