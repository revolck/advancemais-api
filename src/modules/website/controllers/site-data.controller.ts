import { Request, Response } from 'express';
import { WebsiteStatus } from '@prisma/client';

import { WEBSITE_AGGREGATE_CACHE_TTL } from '@/modules/website/config';
import { respondWithCache } from '@/modules/website/utils/cache-response';
import {
  allWebsiteSiteDataSections,
  isWebsiteSiteDataSection,
  websiteSiteDataService,
  type WebsiteSiteDataSection,
} from '@/modules/website/services/site-data.service';

const parseStatus = (value: unknown): WebsiteStatus | undefined => {
  if (value === undefined || value === null || value === '') {
    return WebsiteStatus.PUBLICADO;
  }

  if (typeof value === 'boolean') {
    return value ? WebsiteStatus.PUBLICADO : WebsiteStatus.RASCUNHO;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'ALL' || normalized === 'TODOS') {
      return undefined;
    }
    if (normalized === 'TRUE') {
      return WebsiteStatus.PUBLICADO;
    }
    if (normalized === 'FALSE') {
      return WebsiteStatus.RASCUNHO;
    }
    if (normalized === WebsiteStatus.PUBLICADO || normalized === WebsiteStatus.RASCUNHO) {
      return normalized as WebsiteStatus;
    }
  }

  throw new Error('status inválido. Use PUBLICADO, RASCUNHO, true, false ou ALL.');
};

const parseSections = (value: unknown): WebsiteSiteDataSection[] => {
  if (value === undefined || value === null || value === '') {
    return [...allWebsiteSiteDataSections];
  }

  if (typeof value !== 'string') {
    throw new Error('sections inválido. Use uma lista separada por vírgula.');
  }

  const sections = value
    .split(',')
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return [...allWebsiteSiteDataSections];
  }

  const invalid = sections.filter((section) => !isWebsiteSiteDataSection(section));
  if (invalid.length > 0) {
    throw new Error(`sections inválido: ${invalid.join(', ')}`);
  }

  return sections as WebsiteSiteDataSection[];
};

export class WebsiteSiteDataController {
  static get = async (req: Request, res: Response) => {
    try {
      const sections = parseSections(req.query.sections);
      const status = parseStatus(req.query.status);

      const payload = await websiteSiteDataService.list({ sections, status });
      return respondWithCache(req, res, payload, WEBSITE_AGGREGATE_CACHE_TTL);
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('inválido')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({
        message: 'Erro ao carregar dados agregados do website',
        error: error.message,
      });
    }
  };
}
