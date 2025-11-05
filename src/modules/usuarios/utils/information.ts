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

export const mergeUsuarioInformacoes = <
  T extends { 
    informacoes?: UsuarioInformacoesRecord | null; 
    UsuariosInformation?: UsuarioInformacoesRecord | null;
    redesSociais?: any;
    UsuariosRedesSociais?: any;
  },
>(
  usuario: T,
): Omit<T, 'informacoes' | 'UsuariosInformation' | 'UsuariosRedesSociais'> & {
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
  const rawInformacoes = (usuario as any).informacoes ?? (usuario as any).UsuariosInformation;
  // Suporta tanto 'redesSociais' quanto 'UsuariosRedesSociais' (nome correto do Prisma)
  const rawRedesSociais = (usuario as any).redesSociais ?? (usuario as any).UsuariosRedesSociais;
  const { informacoes: _, UsuariosInformation: __, UsuariosRedesSociais: ___, ...usuarioSemInformacoes } = usuario as any;
  const informacoes = mapUsuarioInformacoes(rawInformacoes);

  return {
    ...usuarioSemInformacoes,
    ...informacoes,
    informacoes,
    redesSociais: rawRedesSociais,
  };
};
