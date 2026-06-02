import { parseScheduleConfig } from '@/utils/cron-helpers';
import type { ConfigDefinition } from '../catalog';

export function firstEnvValue(envKeys: string[]): string | undefined {
  for (const key of envKeys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

export function getEnvSource(envKeys: string[]): string | null {
  return envKeys.find((key) => String(process.env[key] ?? '').trim() !== '') ?? null;
}

export function normalizeConfigValue(
  definition: ConfigDefinition,
  raw: unknown,
): string | number | boolean {
  if (raw === undefined || raw === null) {
    if (definition.defaultValue !== undefined) return definition.defaultValue;
    return '';
  }

  switch (definition.type) {
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const normalized = String(raw).trim().toLowerCase();
      if (['true', '1', 'sim', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'nao', 'não', 'no', 'off'].includes(normalized)) return false;
      return Boolean(raw);
    }
    case 'number': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        throw Object.assign(new Error(`${definition.label} deve ser um número válido`), {
          code: 'INVALID_CONFIG_VALUE',
          statusCode: 400,
        });
      }
      return parsed;
    }
    case 'url': {
      const value = String(raw).trim();
      if (!value) return '';
      try {
        new URL(value);
      } catch {
        throw Object.assign(new Error(`${definition.label} deve ser uma URL válida`), {
          code: 'INVALID_CONFIG_VALUE',
          statusCode: 400,
        });
      }
      return value;
    }
    case 'email': {
      const value = String(raw).trim();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw Object.assign(new Error(`${definition.label} deve ser um e-mail válido`), {
          code: 'INVALID_CONFIG_VALUE',
          statusCode: 400,
        });
      }
      return value;
    }
    case 'csv': {
      return String(raw)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .join(',');
    }
    case 'cron': {
      const value = String(raw).trim();
      if (!value) return String(definition.defaultValue ?? '');
      parseScheduleConfig(value, 60);
      return value;
    }
    case 'string':
    default:
      return String(raw).trim();
  }
}

export function parseEnvValue(definition: ConfigDefinition): string | number | boolean | undefined {
  const value = firstEnvValue(definition.envKeys);
  if (value === undefined) {
    return definition.defaultValue;
  }
  return normalizeConfigValue(definition, value);
}
