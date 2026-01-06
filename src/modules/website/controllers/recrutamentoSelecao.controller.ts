import { Request, Response } from 'express';
import path from 'path';

import { uploadImage } from '@/config/storage';
import { recrutamentoSelecaoService } from '@/modules/website/services/recrutamentoSelecao.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split('.')[0];
  } catch {
    return '';
  }
}

async function uploadRecrutamentoSelecaoImage(file: Express.Multer.File): Promise<string> {
  return uploadImage('website', 'recrutamento-selecao', file);
}

export class RecrutamentoSelecaoController {
  static list = async (req: Request, res: Response) => {
    const itens = await recrutamentoSelecaoService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await recrutamentoSelecaoService.get(id);
      if (!item) {
        return res.status(404).json({ message: 'RecrutamentoSelecao não encontrado' });
      }
      const response = item;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar RecrutamentoSelecao',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao, titulo1, titulo2, titulo3, titulo4 } = req.body;
      let imagemUrl = '';
      if (req.file) {
        imagemUrl = await uploadRecrutamentoSelecaoImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : '';
      const item = await recrutamentoSelecaoService.create({
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
        message: 'Erro ao criar RecrutamentoSelecao',
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
        imagemUrl = await uploadRecrutamentoSelecaoImage(req.file);
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
      const item = await recrutamentoSelecaoService.update(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar RecrutamentoSelecao',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await recrutamentoSelecaoService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover RecrutamentoSelecao',
        error: error.message,
      });
    }
  };
}
