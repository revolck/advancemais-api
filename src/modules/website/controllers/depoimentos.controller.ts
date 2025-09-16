import { Request, Response } from "express";
import { WebsiteStatus } from "@prisma/client";

import { depoimentosService } from "@/modules/website/services/depoimentos.service";
import { respondWithCache } from "@/modules/website/utils/cache-response";

function mapDepoimento(ordem: any) {
  return {
    id: ordem.id,
    depoimentoId: ordem.depoimento.id,
    depoimento: ordem.depoimento.depoimento,
    nome: ordem.depoimento.nome,
    cargo: ordem.depoimento.cargo,
    fotoUrl: ordem.depoimento.fotoUrl,
    status: ordem.status,
    ordem: ordem.ordem,
    criadoEm: ordem.depoimento.criadoEm,
    atualizadoEm: ordem.depoimento.atualizadoEm,
    ordemCriadoEm: ordem.criadoEm,
  };
}

export class DepoimentosController {
  static list = async (req: Request, res: Response) => {
    let { status } = req.query as any;
    if (typeof status === "string") {
      if (status === "true") status = "PUBLICADO";
      else if (status === "false") status = "RASCUNHO";
      else status = status.toUpperCase();
    }
    const itens = await depoimentosService.list(
      status as WebsiteStatus | undefined
    );
    const response = itens.map(mapDepoimento);

    return respondWithCache(req, res, response);
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const ordem = await depoimentosService.get(ordemId);
      if (!ordem) {
        return res.status(404).json({ message: "Depoimento não encontrado" });
      }
      const response = mapDepoimento(ordem);

      return respondWithCache(req, res, response);
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao buscar depoimento",
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { depoimento, nome, cargo, fotoUrl } = req.body;
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      const ordem = await depoimentosService.create({
        depoimento,
        nome,
        cargo,
        fotoUrl,
        status: status as WebsiteStatus,
      });
      res.status(201).json(mapDepoimento(ordem));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao criar depoimento",
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id: depoimentoId } = req.params;
      const { depoimento, nome, cargo, fotoUrl, ordem } = req.body;
      let { status } = req.body as any;
      if (typeof status === "boolean") {
        status = status ? "PUBLICADO" : "RASCUNHO";
      } else if (typeof status === "string") {
        status = status.toUpperCase();
      }
      const data: any = { depoimento, nome, cargo, fotoUrl };
      if (status !== undefined) data.status = status as WebsiteStatus;
      if (ordem !== undefined) data.ordem = parseInt(ordem, 10);
      const ordemResult = await depoimentosService.update(depoimentoId, data);
      res.json(mapDepoimento(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao atualizar depoimento",
        error: error.message,
      });
    }
  };

  static reorder = async (req: Request, res: Response) => {
    try {
      const { id: ordemId } = req.params;
      const { ordem } = req.body;
      const ordemResult = await depoimentosService.reorder(ordemId, parseInt(ordem, 10));
      res.json(mapDepoimento(ordemResult));
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao reordenar depoimento",
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id: depoimentoId } = req.params;
      await depoimentosService.remove(depoimentoId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao remover depoimento",
        error: error.message,
      });
    }
  };
}

