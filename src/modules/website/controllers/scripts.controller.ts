import { Request, Response } from 'express';
import { WebsiteScriptAplicacao, WebsiteScriptOrientation, WebsiteStatus } from '@prisma/client';

import { websiteScriptsService } from '@/modules/website/services/scripts.service';
import { respondWithCache } from '@/modules/website/utils/cache-response';

const ORIENTATIONS = new Set(
  Object.values(WebsiteScriptOrientation).map((value) => value.toString()),
);
const STATUSES = new Set(Object.values(WebsiteStatus).map((value) => value.toString()));
const APPLICATIONS = new Set(
  Object.values(WebsiteScriptAplicacao).map((value) => value.toString()),
);

function normalizeStatus(value: unknown): WebsiteStatus | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value ? WebsiteStatus.PUBLICADO : WebsiteStatus.RASCUNHO;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (STATUSES.has(normalized)) {
      return normalized as WebsiteStatus;
    }
  }
  throw new Error('Status inválido. Valores aceitos: PUBLICADO, RASCUNHO, true ou false.');
}

function normalizeOrientation(value: unknown): WebsiteScriptOrientation {
  if (typeof value !== 'string') {
    throw new Error('Orientação inválida. Informe HEADER, BODY ou FOOTER.');
  }
  const normalized = value.trim().toUpperCase();
  if (!ORIENTATIONS.has(normalized)) {
    throw new Error('Orientação inválida. Valores aceitos: HEADER, BODY ou FOOTER.');
  }
  return normalized as WebsiteScriptOrientation;
}

function normalizeApplication(value: unknown): WebsiteScriptAplicacao {
  if (typeof value !== 'string') {
    throw new Error('Aplicação inválida. Informe WEBSITE ou DASHBOARD.');
  }
  const normalized = value.trim().toUpperCase();
  if (!APPLICATIONS.has(normalized)) {
    throw new Error('Aplicação inválida. Valores aceitos: WEBSITE ou DASHBOARD.');
  }
  return normalized as WebsiteScriptAplicacao;
}

export class WebsiteScriptsController {
  static list = async (req: Request, res: Response) => {
    try {
      const { aplicacao, orientacao, status } = req.query;

      const filters: {
        aplicacao?: WebsiteScriptAplicacao;
        orientacao?: WebsiteScriptOrientation;
        status?: WebsiteStatus;
      } = {};

      if (aplicacao !== undefined) {
        filters.aplicacao = normalizeApplication(String(aplicacao));
      }

      if (orientacao !== undefined) {
        filters.orientacao = normalizeOrientation(String(orientacao));
      }

      if (status !== undefined) {
        filters.status = normalizeStatus(status);
      }

      const scripts = await websiteScriptsService.list(filters);
      return respondWithCache(req, res, scripts);
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('inválid')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({
        message: 'Erro ao listar scripts',
        error: error.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const script = await websiteScriptsService.get(id);
      if (!script) {
        return res.status(404).json({ message: 'Script não encontrado' });
      }
      return respondWithCache(req, res, script);
    } catch (error: any) {
      return res.status(500).json({
        message: 'Erro ao buscar script',
        error: error.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { nome, descricao, codigo, aplicacao, orientacao, status } = req.body;

      if (aplicacao === undefined || aplicacao === null || aplicacao === '') {
        return res
          .status(400)
          .json({ message: 'O campo "aplicacao" é obrigatório e deve ser WEBSITE ou DASHBOARD.' });
      }
      if (orientacao === undefined || orientacao === null || orientacao === '') {
        return res.status(400).json({ message: 'O campo "orientacao" é obrigatório.' });
      }

      if (typeof codigo !== 'string' || !codigo.trim()) {
        return res.status(400).json({ message: 'O campo "codigo" é obrigatório.' });
      }

      const normalizedApplication = normalizeApplication(aplicacao);
      const normalizedOrientation = normalizeOrientation(orientacao);
      const normalizedStatus = normalizeStatus(status);

      const script = await websiteScriptsService.create({
        nome,
        descricao,
        codigo,
        aplicacao: normalizedApplication,
        orientacao: normalizedOrientation,
        status: normalizedStatus,
      });

      return res.status(201).json(script);
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('inválid')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({
        message: 'Erro ao criar script',
        error: error.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nome, descricao, codigo, aplicacao, orientacao, status } = req.body;
      const data: {
        nome?: string;
        descricao?: string;
        codigo?: string;
        aplicacao?: WebsiteScriptAplicacao;
        orientacao?: WebsiteScriptOrientation;
        status?: WebsiteStatus;
      } = {};

      if (nome !== undefined) data.nome = nome;
      if (descricao !== undefined) data.descricao = descricao;
      if (codigo !== undefined) {
        if (typeof codigo !== 'string' || !codigo.trim()) {
          return res.status(400).json({ message: 'O campo "codigo" deve ser um texto não vazio.' });
        }
        data.codigo = codigo;
      }
      if (aplicacao !== undefined) {
        data.aplicacao = normalizeApplication(aplicacao);
      }
      if (orientacao !== undefined) {
        data.orientacao = normalizeOrientation(orientacao);
      }
      if (status !== undefined) {
        data.status = normalizeStatus(status);
      }

      const script = await websiteScriptsService.update(id, data);
      return res.json(script);
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('inválid')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Script não encontrado' });
      }
      return res.status(500).json({
        message: 'Erro ao atualizar script',
        error: error.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await websiteScriptsService.remove(id);
      return res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Script não encontrado' });
      }
      return res.status(500).json({
        message: 'Erro ao remover script',
        error: error.message,
      });
    }
  };
}
