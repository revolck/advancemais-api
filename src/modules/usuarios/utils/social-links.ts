import type { UsuarioSocialLinks } from './types';

export type UsuarioSocialLinksInput =
  | Partial<Record<keyof UsuarioSocialLinks, string | null | undefined>>
  | null
  | undefined;

export interface SanitizedSocialLinks {
  values: UsuarioSocialLinks;
  provided: Set<keyof UsuarioSocialLinks>;
  hasAnyValue: boolean;
}

const sanitizeSocialLinkValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isRecord = (input: UsuarioSocialLinksInput): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null;

export const sanitizeSocialLinks = (
  input?: UsuarioSocialLinksInput,
): SanitizedSocialLinks | null => {
  if (!input || !isRecord(input)) {
    return null;
  }

  const provided = new Set<keyof UsuarioSocialLinks>();

  const rawValue = <K extends keyof UsuarioSocialLinks>(key: K) => {
    const value = input[key];
    if (value !== undefined) {
      provided.add(key);
    }
    return value as string | null | undefined;
  };

  const values: UsuarioSocialLinks = {
    instagram: sanitizeSocialLinkValue(rawValue('instagram')),
    linkedin: sanitizeSocialLinkValue(rawValue('linkedin')),
    facebook: sanitizeSocialLinkValue(rawValue('facebook')),
    youtube: sanitizeSocialLinkValue(rawValue('youtube')),
    twitter: sanitizeSocialLinkValue(rawValue('twitter')),
    tiktok: sanitizeSocialLinkValue(rawValue('tiktok')),
  };

  if (provided.size === 0) {
    return null;
  }

  const hasAnyValue = Array.from(provided).some((key) => values[key] !== null);

  return { values, provided, hasAnyValue };
};

export const buildSocialLinksCreateData = (
  sanitized: SanitizedSocialLinks | null,
): UsuarioSocialLinks | null => {
  if (!sanitized || !sanitized.hasAnyValue) {
    return null;
  }

  return sanitized.values;
};

export const buildSocialLinksUpdateData = (
  sanitized: SanitizedSocialLinks | null,
): Partial<UsuarioSocialLinks> | null => {
  if (!sanitized || sanitized.provided.size === 0) {
    return null;
  }

  return Array.from(sanitized.provided).reduce<Partial<UsuarioSocialLinks>>((acc, key) => {
    acc[key] = sanitized.values[key];
    return acc;
  }, {});
};

export const extractSocialLinksFromPayload = (
  payload: Record<string, unknown> | null | undefined,
  nestedKey = 'socialLinks',
): UsuarioSocialLinksInput => {
  if (!payload) {
    return undefined;
  }

  const nested = payload[nestedKey];
  const result: Record<string, string | null> = {};

  const assignValue = (key: keyof UsuarioSocialLinks) => {
    if (nested && typeof nested === 'object' && nested !== null && key in (nested as Record<string, unknown>)) {
      const value = (nested as Record<string, unknown>)[key];
      if (value !== undefined) {
        result[key] = value === null ? null : String(value);
        return;
      }
    }

    if (key in payload) {
      const value = payload[key];
      if (value !== undefined) {
        result[key] = value === null ? null : String(value);
      }
    }
  };

  (['instagram', 'linkedin', 'facebook', 'youtube', 'twitter', 'tiktok'] as const).forEach(assignValue);

  return Object.keys(result).length > 0 ? (result as UsuarioSocialLinksInput) : undefined;
};

export const mapSocialLinks = (
  links?: UsuarioSocialLinks | null,
): UsuarioSocialLinks | null => {
  if (!links) {
    return null;
  }

  return {
    instagram: links.instagram ?? null,
    linkedin: links.linkedin ?? null,
    facebook: links.facebook ?? null,
    youtube: links.youtube ?? null,
    twitter: links.twitter ?? null,
    tiktok: links.tiktok ?? null,
  };
};

export const usuarioRedesSociaisSelect = {
  redesSociais: {
    select: {
      instagram: true,
      linkedin: true,
      facebook: true,
      youtube: true,
      twitter: true,
      tiktok: true,
    },
  },
} as const;
