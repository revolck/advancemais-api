import type { Prisma } from '@prisma/client';

export const usuarioInformacoesSelect = {
  telefone: true,
  genero: true,
  dataNasc: true,
  matricula: true,
  avatarUrl: true,
  descricao: true,
  aceitarTermos: true,
} as const;

export type UsuarioInformacoesSelect = typeof usuarioInformacoesSelect;

export type UsuarioInformacoesRecord = Prisma.UsuariosInformationGetPayload<{
  select: UsuarioInformacoesSelect;
}>;

type UsuarioInformacoesInput = UsuarioInformacoesRecord | UsuarioInformacoesDto | null | undefined;

export interface UsuarioInformacoesDto {
  telefone: string | null;
  genero: string | null;
  dataNasc: Date | null;
  matricula: string | null;
  avatarUrl: string | null;
  descricao: string | null;
  aceitarTermos: boolean;
}

const resolveDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

export const mapUsuarioInformacoes = (
  informacoes?: UsuarioInformacoesInput,
): UsuarioInformacoesDto => ({
  telefone: informacoes?.telefone ?? null,
  genero: informacoes?.genero ?? null,
  dataNasc: resolveDate(informacoes?.dataNasc ?? null),
  matricula: informacoes?.matricula ?? null,
  avatarUrl: informacoes?.avatarUrl ?? null,
  descricao: informacoes?.descricao ?? null,
  aceitarTermos: informacoes?.aceitarTermos ?? false,
});

export const mergeUsuarioInformacoes = <
  T extends { informacoes?: UsuarioInformacoesRecord | null },
>(
  usuario: T,
): Omit<T, 'informacoes'> & {
  informacoes: UsuarioInformacoesDto;
  telefone: string | null;
  genero: string | null;
  dataNasc: Date | null;
  matricula: string | null;
  avatarUrl: string | null;
  descricao: string | null;
  aceitarTermos: boolean;
} => {
  const { informacoes: rawInformacoes, ...usuarioSemInformacoes } = usuario;
  const informacoes = mapUsuarioInformacoes(rawInformacoes);

  return {
    ...usuarioSemInformacoes,
    ...informacoes,
    informacoes,
  };
};
