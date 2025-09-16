import type { Request, Response } from 'express';

import { WEBSITE_CACHE_TTL } from '@/modules/website/config';
import { setCacheHeaders } from '@/utils/cache';

const normalizeTags = (header: string | string[] | undefined): string[] => {
  if (!header) {
    return [];
  }

  const raw = Array.isArray(header) ? header : header.split(',');
  return raw
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^W\//, '').replace(/"/g, ''));
};

export function respondWithCache<T>(
  req: Request,
  res: Response,
  data: T,
  ttl = WEBSITE_CACHE_TTL,
): Response {
  const etag = setCacheHeaders(res, data, ttl);
  const matches = normalizeTags(req.headers['if-none-match']);

  if (matches.includes(etag)) {
    return res.status(304).end();
  }

  return res.json(data);
}
