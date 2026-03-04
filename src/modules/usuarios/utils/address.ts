import type { UsuariosEnderecos } from '@prisma/client';

export interface UsuarioEnderecoDto {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  complemento?: string | null;
  principal?: boolean;
}

type MaybeEndereco = Partial<UsuarioEnderecoDto> | UsuariosEnderecos;

type NormalizedEndereco = {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  complemento: string | null;
  principal: boolean;
};

const ESTADO_TO_UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

const normalizeEstadoUf = (value?: string | null) => {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  const key = normalized
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();

  return ESTADO_TO_UF[key] ?? normalized.toUpperCase();
};

const enderecoScore = (endereco: Omit<NormalizedEndereco, 'principal'>) => {
  let score = 0;
  if (endereco.logradouro) score += 2;
  if (endereco.numero) score += 1;
  if (endereco.bairro) score += 1;
  if (endereco.cidade) score += 2;
  if (endereco.estado) score += 2;
  if (endereco.cep) score += 2;
  if (endereco.complemento) score += 1;
  return score;
};

export const normalizeUsuarioEnderecos = (
  enderecos?: MaybeEndereco[] | null,
): UsuarioEnderecoDto[] => {
  if (!Array.isArray(enderecos)) {
    return [];
  }

  const normalized: NormalizedEndereco[] = [];

  for (const item of enderecos) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const idValue = item.id ? String(item.id) : null;

    if (!idValue) {
      continue;
    }

    normalized.push({
      id: idValue,
      logradouro: item.logradouro ?? null,
      numero: item.numero ?? null,
      bairro: item.bairro ?? null,
      cidade: item.cidade ?? null,
      estado: normalizeEstadoUf(item.estado),
      cep: item.cep ?? null,
      complemento: (item as any).complemento ?? null,
      principal: (item as any).principal === true,
    });
  }

  if (normalized.length === 0) return [];

  let principalIndex = 0;
  let bestScore = -1;

  normalized.forEach((item, index) => {
    if (item.principal) {
      principalIndex = index;
      bestScore = Number.MAX_SAFE_INTEGER;
      return;
    }

    if (bestScore === Number.MAX_SAFE_INTEGER) {
      return;
    }

    const score = enderecoScore(item);
    if (score > bestScore) {
      bestScore = score;
      principalIndex = index;
    }
  });

  const withPrincipal = normalized.map((item, index) => ({
    ...item,
    principal: index === principalIndex,
    complemento: item.complemento ?? item.bairro ?? null,
  }));

  return withPrincipal;
};

export const extractEnderecoResumo = (enderecos?: MaybeEndereco[] | null) => {
  const normalized = normalizeUsuarioEnderecos(enderecos);
  const principal = normalized.find((item) => item.principal) ?? normalized[0];

  return {
    enderecos: normalized,
    enderecoPrincipal: principal ?? null,
    cidade: principal?.cidade ?? null,
    estado: principal?.estado ?? null,
  };
};

export const attachEnderecoResumo = <T extends Record<string, any>>(
  usuario: T | null | undefined,
) => {
  if (!usuario) {
    return null;
  }

  // Suporta tanto 'enderecos' quanto 'UsuariosEnderecos' (nome correto do Prisma)
  const rawEnderecos = (usuario as any).UsuariosEnderecos ?? (usuario as any).enderecos ?? [];
  const { enderecos, enderecoPrincipal, cidade, estado } = extractEnderecoResumo(rawEnderecos);

  return {
    ...usuario,
    enderecos,
    enderecoPrincipal,
    cidade,
    estado,
  } as T & {
    enderecos: UsuarioEnderecoDto[];
    enderecoPrincipal: UsuarioEnderecoDto | null;
    cidade: string | null;
    estado: string | null;
  };
};

export const hasEnderecoCadastrado = (enderecos?: MaybeEndereco[] | null) =>
  normalizeUsuarioEnderecos(enderecos).length > 0;
