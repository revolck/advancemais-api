import { Request, Response } from 'express';
import { WebsiteStatus } from '@prisma/client';

import { teamService } from '@/modules/website/services/team.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

function mapTeam(ordem: any) {
  return {
    id: ordem.id,
    teamId: ordem.team.id,
    photoUrl: ordem.team.photoUrl,
    nome: ordem.team.nome,
    cargo: ordem.team.cargo,
    status: ordem.status,
    ordem: ordem.ordem,
    criadoEm: ordem.team.criadoEm,
    atualizadoEm: ordem.team.atualizadoEm,
    ordemCriadoEm: ordem.criadoEm,
  };
}

export class TeamController {
  static list = async (req: Request, res: Response) => {
    let { status } = req.query as any;
    if (typeof status === 'string') {
      if (status === 'true') status = 'PUBLICADO';
      else if (status === 'false') status = 'RASCUNHO';
      else status = status.toUpperCase();
    }
    const itens = await teamService.list(status as WebsiteStatus | undefined);
    const response = itens.map(mapTeam);

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const ordem = await teamService.get(ordemId);
      if (!ordem) {
        return res.status(404).json({ message: 'Team member não encontrado' });
      }
      const response = mapTeam(ordem);

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao buscar team member',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { nome, cargo, photoUrl } = req.body;
      let { status } = req.body as any;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      const ordem = await teamService.create({
        photoUrl,
        nome,
        cargo,
        status: status as WebsiteStatus,
      });
      res.status(201).json(mapTeam(ordem));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao criar team member',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id: teamId } = req.params;
      const { nome, cargo, photoUrl, ordem } = req.body;
      let { status } = req.body as any;
      if (typeof status === 'boolean') {
        status = status ? 'PUBLICADO' : 'RASCUNHO';
      } else if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      const data: any = { nome, cargo };
      if (photoUrl) {
        data.photoUrl = photoUrl;
      }
      if (status !== undefined) data.status = status as WebsiteStatus;
      if (ordem !== undefined) data.ordem = parseInt(ordem, 10);
      const ordemResult = await teamService.update(teamId, data);
      res.json(mapTeam(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao atualizar team member',
        error: error.message,
      });
    }
  };

  static reorder = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const { ordem } = req.body;
      const ordemResult = await teamService.reorder(ordemId, parseInt(ordem, 10));
      res.json(mapTeam(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao reordenar team member',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id: teamId } = req.params;
      await teamService.remove(teamId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: 'Erro ao remover team member',
        error: error.message,
      });
    }
  };
}
