import { Request, Response } from 'express';
import path from 'path';

import { uploadImage } from '@/config/storage';
import { recrutamentoService } from '@/modules/website/services/recrutamento.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split('.')[0];
  } catch {
    return '';
  }
}

async function uploadRecrutamentoImage(file: Express.Multer.File): Promise<string> {
  return uploadImage('website', 'recrutamento', file);
}

export class RecrutamentoController {
  static list = async (req: Request, res: Response) => {
    const itens = await recrutamentoService.list();
    const response = itens;

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const recrutamento = await recrutamentoService.get(id);
      if (!recrutamento) {
        return res.status(404).json({ message: 'Recrutamento não encontrado' });
      }
      const response = recrutamento;

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao buscar recrutamento', error: error.message });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { titulo, descricao, buttonUrl, buttonLabel } = req.body;
      let imagemUrl = '';
      if (req.file) {
        imagemUrl = await uploadRecrutamentoImage(req.file);
      } else if (typeof req.body.imagemUrl === 'string') {
        imagemUrl = req.body.imagemUrl.trim();
      }
      const imagemTitulo = imagemUrl ? generateImageTitle(imagemUrl) : '';
      const recrutamento = await recrutamentoService.create({
        imagemUrl,
        imagemTitulo,
        titulo,
        descricao,
        buttonUrl,
        buttonLabel,
      });
      res.status(201).json(recrutamento);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar recrutamento',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { titulo, descricao, buttonUrl, buttonLabel } = req.body;
      const imagemUrlRaw = req.body.imagemUrl;
      let imagemUrl = typeof imagemUrlRaw === 'string' ? imagemUrlRaw.trim() : undefined;
      if (req.file) {
        imagemUrl = await uploadRecrutamentoImage(req.file);
      }
      const data: any = {};
      if (titulo !== undefined) data.titulo = titulo;
      if (descricao !== undefined) data.descricao = descricao;
      if (buttonUrl !== undefined) data.buttonUrl = buttonUrl;
      if (buttonLabel !== undefined) data.buttonLabel = buttonLabel;
      if (imagemUrl !== undefined) {
        data.imagemUrl = imagemUrl;
        data.imagemTitulo = generateImageTitle(imagemUrl);
      }
      const recrutamento = await recrutamentoService.update(id, data);
      res.json(recrutamento);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar recrutamento',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await recrutamentoService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover recrutamento',
        error: error.message,
      });
    }
  };
}
