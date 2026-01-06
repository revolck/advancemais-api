import { Request, Response } from 'express';

import { uploadImage } from '@/config/storage';
import { sliderService } from '@/modules/website/services/slider.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

/**
 * Mapeia uma ordem de slider para o formato exposto na API.
 *
 * `id`        → identificador da ordem do slider
 * `sliderId`  → identificador do slider propriamente dito
 */
function mapSlider(ordem: any) {
  return {
    id: ordem.id,
    sliderId: ordem.WebsiteSlider.id,
    sliderName: ordem.WebsiteSlider.WebsiteSliderName,
    imagemUrl: ordem.WebsiteSlider.imagemUrl,
    link: ordem.WebsiteSlider.link,
    criadoEm: ordem.WebsiteSlider.criadoEm,
    atualizadoEm: ordem.WebsiteSlider.atualizadoEm,
    ordem: ordem.ordem,
    orientacao: ordem.orientacao,
    status: ordem.status,
    ordemCriadoEm: ordem.criadoEm,
  };
}

async function uploadSlideImage(file: Express.Multer.File): Promise<string> {
  return uploadImage('website', 'slide', file);
}

export class SliderController {
  static list = async (req: Request, res: Response) => {
    const itens = await sliderService.list();
    const response = itens.map(mapSlider);

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const ordem = await sliderService.get(ordemId);
      if (!ordem) {
        return res.status(404).json({ message: 'Slider não encontrado' });
      }
      const response = mapSlider(ordem);

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar slider',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { sliderName, link, orientacao } = req.body;
      let { status } = req.body;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      let imagemUrl = '';
      if (req.file) {
        imagemUrl = await uploadSlideImage(req.file);
      } else if (req.body.imagemUrl) {
        imagemUrl = req.body.imagemUrl;
      }
      const ordem = await sliderService.create({
        sliderName,
        imagemUrl,
        link,
        orientacao,
        status,
      });
      res.status(201).json(mapSlider(ordem));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar slider',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id: sliderId } = req.params;
      const { sliderName, link, orientacao, ordem } = req.body;
      let { status } = req.body as any;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      let imagemUrl = req.body.imagemUrl as string | undefined;
      if (req.file) {
        imagemUrl = await uploadSlideImage(req.file);
      }
      const data: any = {};
      if (sliderName !== undefined) data.WebsiteSliderName = sliderName;
      if (link !== undefined) data.link = link;
      if (orientacao !== undefined) data.orientacao = orientacao;
      if (status !== undefined) data.status = status;
      if (ordem !== undefined) {
        data.ordem = parseInt(ordem, 10);
      }
      if (imagemUrl) {
        data.imagemUrl = imagemUrl;
      }
      const ordemResult = await sliderService.update(sliderId, data);
      res.json(mapSlider(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar slider',
        error: error.message,
      });
    }
  };

  static reorder = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const { ordem } = req.body;
      const ordemResult = await sliderService.reorder(ordemId, parseInt(ordem, 10));
      res.json(mapSlider(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao reordenar slider',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id: sliderId } = req.params;
      await sliderService.remove(sliderId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover slider',
        error: error.message,
      });
    }
  };
}
