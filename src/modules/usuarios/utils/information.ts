import type { Prisma } from '@prisma/client';

export const usuarioInformacoesSelect = {
  telefone: true,
  genero: true,
  dataNasc: true,
  inscricao: true,
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
  inscricao: string | null;
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
  inscricao: informacoes?.inscricao ?? null,
  avatarUrl: informacoes?.avatarUrl ?? null,
  descricao: informacoes?.descricao ?? null,
  aceitarTermos: informacoes?.aceitarTermos ?? false,
});

export const mergeUsuarioInformacoes = <T extends Record<string, any>>(
  usuario: T,
): T & {
  informacoes: UsuarioInformacoesDto;
  redesSociais?: any;
  telefone: string | null;
  genero: string | null;
  dataNasc: Date | null;
  inscricao: string | null;
  avatarUrl: string | null;
  descricao: string | null;
  aceitarTermos: boolean;
} => {
  // Suporta tanto 'informacoes' quanto 'UsuariosInformation' (nome correto do Prisma)
  const rawInformacoes = (usuario as any).UsuariosInformation ?? (usuario as any).informacoes;
  // Suporta tanto 'redesSociais' quanto 'UsuariosRedesSociais' (nome correto do Prisma)
  const rawRedesSociais = (usuario as any).UsuariosRedesSociais ?? (usuario as any).redesSociais;
  const informacoes = mapUsuarioInformacoes(rawInformacoes);

  return {
    ...(usuario as any),
    ...informacoes,
    informacoes,
    redesSociais: rawRedesSociais,
  };
};
