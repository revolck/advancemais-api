import { Request, Response } from 'express';
import path from 'path';
import { WebsiteStatus } from '@prisma/client';

import { supabase } from '@/config/supabase';
import { logoEnterpriseService } from '@/modules/website/services/logoEnterprise.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function mapLogo(ordem: any) {
  const logo = ordem.WebsiteLogoEnterprise || ordem.logo; // Suporta ambos para compatibilidade
  return {
    id: ordem.id,
    logoId: logo.id,
    nome: logo.nome,
    imagemUrl: logo.imagemUrl,
    imagemAlt: logo.imagemAlt,
    website: logo.website,
    criadoEm: logo.criadoEm,
    atualizadoEm: logo.atualizadoEm,
    ordem: ordem.ordem,
    status: ordem.status,
    ordemCriadoEm: ordem.criadoEm,
  };
}

function generateImageTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.basename(pathname).split('.')[0];
  } catch {
    return '';
  }
}

async function uploadImage(file: Express.Multer.File): Promise<string> {
  const fileExt = path.extname(file.originalname);
  const fileName = `logo-${Date.now()}${fileExt}`;
  const { error } = await supabase.storage
    .from('website')
    .upload(`logos/${fileName}`, file.buffer, {
      contentType: file.mimetype,
    });
  if (error) throw error;
  const { data } = supabase.storage.from('website').getPublicUrl(`logos/${fileName}`);
  return data.publicUrl;
}

export class LogoEnterpriseController {
  static list = async (req: Request, res: Response) => {
    const itens = await logoEnterpriseService.list();
    const response = itens.map(mapLogo);

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await logoEnterpriseService.get(id);
      if (!item) {
        return res.status(404).json({ message: 'Logo não encontrado' });
      }
      const response = mapLogo(item);

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar logo',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { nome, website } = req.body;
      let { status } = req.body as any;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      let imagemUrl = '';
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const imagemAlt = req.body.imagemAlt || (imagemUrl ? generateImageTitle(imagemUrl) : '');
      const ordem = await logoEnterpriseService.create({
        nome,
        imagemUrl,
        imagemAlt,
        website,
        status,
      });
      res.status(201).json(mapLogo(ordem));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar logo',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id: logoId } = req.params;
      const { nome, website, ordem } = req.body;
      let { status } = req.body as any;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadImage(req.file);
      }
      const data: any = { nome, website };
      if (status !== undefined) data.status = status as WebsiteStatus;
      if (ordem !== undefined) {
        data.ordem = parseInt(ordem, 10);
      }
      const imagemAlt = req.body.imagemAlt as string | undefined;
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
        data.imagemAlt = imagemAlt || generateImageTitle(imagemUrl);
      } else if (imagemAlt !== undefined) {
        data.imagemAlt = imagemAlt;
      }
      const ordemResult = await logoEnterpriseService.update(logoId, data);
      res.json(mapLogo(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar logo',
        error: error.message,
      });
    }
  };

  static reorder = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const { ordem } = req.body;
      const ordemResult = await logoEnterpriseService.reorder(ordemId, parseInt(ordem, 10));
      res.json(mapLogo(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao reordenar logo',
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
        message: 'Erro ao remover logo',
        error: error.message,
      });
    }
  };
}
