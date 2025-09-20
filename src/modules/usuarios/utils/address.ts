import type { Enderecos } from '@prisma/client';

export interface UsuarioEnderecoDto {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

type MaybeEndereco = Partial<UsuarioEnderecoDto> | Enderecos;

export const normalizeUsuarioEnderecos = (
  enderecos?: MaybeEndereco[] | null,
): UsuarioEnderecoDto[] => {
  if (!Array.isArray(enderecos)) {
    return [];
  }

  return enderecos
    .filter((item): item is MaybeEndereco => typeof item === 'object' && item !== null)
    .map((endereco) => {
      const idValue = endereco.id ? String(endereco.id) : null;

      if (!idValue) {
        return null;
      }

      return {
        id: idValue,
        logradouro: endereco.logradouro ?? null,
        numero: endereco.numero ?? null,
        bairro: endereco.bairro ?? null,
        cidade: endereco.cidade ?? null,
        estado: endereco.estado ?? null,
        cep: endereco.cep ?? null,
      } satisfies UsuarioEnderecoDto | null;
    })
    .filter((endereco): endereco is UsuarioEnderecoDto => Boolean(endereco));
};

export const extractEnderecoResumo = (
  enderecos?: MaybeEndereco[] | null,
) => {
  const normalized = normalizeUsuarioEnderecos(enderecos);
  const [principal] = normalized;

  return {
    enderecos: normalized,
    cidade: principal?.cidade ?? null,
    estado: principal?.estado ?? null,
  };
};

export const attachEnderecoResumo = <T extends { enderecos?: MaybeEndereco[] | null }>(
  usuario: T | null | undefined,
) => {
  if (!usuario) {
    return null;
  }

  const { enderecos, cidade, estado } = extractEnderecoResumo(usuario.enderecos ?? []);

  return {
    ...usuario,
    enderecos,
    cidade,
    estado,
  } as T & {
    enderecos: UsuarioEnderecoDto[];
    cidade: string | null;
    estado: string | null;
  };
};

export const hasEnderecoCadastrado = (enderecos?: MaybeEndereco[] | null) =>
  normalizeUsuarioEnderecos(enderecos).length > 0;
