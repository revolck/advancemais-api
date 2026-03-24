import { AuditoriaCategoria, Prisma, Roles, Status } from '@prisma/client';

export const USER_HISTORY_CATEGORIAS = [
  'CADASTRO',
  'PERFIL',
  'SEGURANCA',
  'ACESSO',
  'STATUS',
  'ADMINISTRATIVO',
] as const;

export const USER_HISTORY_TIPOS = [
  'USUARIO_CRIADO',
  'USUARIO_ATUALIZADO',
  'USUARIO_STATUS_ALTERADO',
  'USUARIO_ROLE_ALTERADA',
  'USUARIO_ACESSO_LIBERADO',
  'USUARIO_BLOQUEADO',
  'USUARIO_DESBLOQUEADO',
  'USUARIO_EMAIL_LIBERADO',
  'USUARIO_EMAIL_VERIFICADO',
  'USUARIO_SENHA_RESETADA',
  'USUARIO_LOGIN',
  'USUARIO_LOGOUT',
  'USUARIO_ENDERECO_ATUALIZADO',
  'USUARIO_SOCIAL_LINK_ATUALIZADO',
  'USUARIO_AVATAR_ATUALIZADO',
  'USUARIO_CPF_ATUALIZADO',
  'USUARIO_TELEFONE_ATUALIZADO',
] as const;

export type UserHistoryCategoria = (typeof USER_HISTORY_CATEGORIAS)[number];
export type UserHistoryTipo = (typeof USER_HISTORY_TIPOS)[number];

type UserHistoryActionConfig = {
  tipo: UserHistoryTipo;
  categoria: UserHistoryCategoria;
  titulo: string;
  auditoriaCategoria: AuditoriaCategoria;
};

const defaultActionConfig: UserHistoryActionConfig = {
  tipo: 'USUARIO_ATUALIZADO',
  categoria: 'ADMINISTRATIVO',
  titulo: 'Evento administrativo do usuário',
  auditoriaCategoria: AuditoriaCategoria.USUARIO,
};

const actionConfigMap: Record<string, UserHistoryActionConfig> = {
  USUARIO_CRIADO: {
    tipo: 'USUARIO_CRIADO',
    categoria: 'CADASTRO',
    titulo: 'Conta criada',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_ATUALIZADO: {
    tipo: 'USUARIO_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'Perfil atualizado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_STATUS_ALTERADO: {
    tipo: 'USUARIO_STATUS_ALTERADO',
    categoria: 'STATUS',
    titulo: 'Status do usuário alterado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_ROLE_ALTERADA: {
    tipo: 'USUARIO_ROLE_ALTERADA',
    categoria: 'ADMINISTRATIVO',
    titulo: 'Role do usuário alterada',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_ACESSO_LIBERADO: {
    tipo: 'USUARIO_ACESSO_LIBERADO',
    categoria: 'ACESSO',
    titulo: 'Acesso liberado manualmente',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_BLOQUEADO: {
    tipo: 'USUARIO_BLOQUEADO',
    categoria: 'SEGURANCA',
    titulo: 'Usuário bloqueado',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_DESBLOQUEADO: {
    tipo: 'USUARIO_DESBLOQUEADO',
    categoria: 'SEGURANCA',
    titulo: 'Usuário desbloqueado',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_EMAIL_LIBERADO: {
    tipo: 'USUARIO_EMAIL_LIBERADO',
    categoria: 'SEGURANCA',
    titulo: 'Validação de email liberada manualmente',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_EMAIL_LIBERADO_MANUALMENTE: {
    tipo: 'USUARIO_EMAIL_LIBERADO',
    categoria: 'SEGURANCA',
    titulo: 'Validação de email liberada manualmente',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_EMAIL_VERIFICADO: {
    tipo: 'USUARIO_EMAIL_VERIFICADO',
    categoria: 'SEGURANCA',
    titulo: 'Email verificado',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_SENHA_RESETADA: {
    tipo: 'USUARIO_SENHA_RESETADA',
    categoria: 'SEGURANCA',
    titulo: 'Senha resetada',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_LOGIN: {
    tipo: 'USUARIO_LOGIN',
    categoria: 'ACESSO',
    titulo: 'Login realizado',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_LOGOUT: {
    tipo: 'USUARIO_LOGOUT',
    categoria: 'ACESSO',
    titulo: 'Logout realizado',
    auditoriaCategoria: AuditoriaCategoria.SEGURANCA,
  },
  USUARIO_ENDERECO_ATUALIZADO: {
    tipo: 'USUARIO_ENDERECO_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'Endereço atualizado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_SOCIAL_LINK_ATUALIZADO: {
    tipo: 'USUARIO_SOCIAL_LINK_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'Redes sociais atualizadas',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_AVATAR_ATUALIZADO: {
    tipo: 'USUARIO_AVATAR_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'Avatar atualizado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_CPF_ATUALIZADO: {
    tipo: 'USUARIO_CPF_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'CPF atualizado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
  USUARIO_TELEFONE_ATUALIZADO: {
    tipo: 'USUARIO_TELEFONE_ATUALIZADO',
    categoria: 'PERFIL',
    titulo: 'Telefone atualizado',
    auditoriaCategoria: AuditoriaCategoria.USUARIO,
  },
};

const roleLabelMap: Partial<Record<Roles, string>> = {
  [Roles.ADMIN]: 'Administrador',
  [Roles.MODERADOR]: 'Moderador',
  [Roles.PEDAGOGICO]: 'Setor Pedagógico',
  [Roles.INSTRUTOR]: 'Instrutor',
  [Roles.ALUNO_CANDIDATO]: 'Aluno/Candidato',
  [Roles.EMPRESA]: 'Empresa',
  [Roles.SETOR_DE_VAGAS]: 'Setor de Vagas',
  [Roles.RECRUTADOR]: 'Recrutador',
  [Roles.FINANCEIRO]: 'Financeiro',
};

export const getUserHistoryConfig = (actionOrType?: string | null): UserHistoryActionConfig => {
  if (!actionOrType) {
    return defaultActionConfig;
  }

  return actionConfigMap[actionOrType] ?? defaultActionConfig;
};

export const getUserRoleLabel = (role?: string | null) => {
  if (!role) {
    return 'Sistema';
  }

  return roleLabelMap[role as Roles] ?? role;
};

export const toAuditJson = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const isSameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export const diffSnapshot = <
  T extends Record<string, unknown> | null | undefined,
  U extends Record<string, unknown> | null | undefined,
>(
  before: T,
  after: U,
) => {
  const beforeRecord: Record<string, unknown> = before ?? {};
  const afterRecord: Record<string, unknown> = after ?? {};
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of keys) {
    if (!isSameValue(beforeRecord[key], afterRecord[key])) {
      changedBefore[key] = beforeRecord[key] ?? null;
      changedAfter[key] = afterRecord[key] ?? null;
    }
  }

  return {
    before: Object.keys(changedBefore).length > 0 ? changedBefore : null,
    after: Object.keys(changedAfter).length > 0 ? changedAfter : null,
  };
};

type UserAuditClient = {
  auditoriaLogs: {
    create: (args: Prisma.AuditoriaLogsCreateArgs) => Promise<unknown>;
  };
};

type RecordUserAuditEventParams = {
  client: UserAuditClient;
  actorId?: string | null;
  actorRole?: string | null;
  targetUserId: string;
  action: string;
  descricao: string;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export const recordUserAuditEvent = async ({
  client,
  actorId,
  actorRole,
  targetUserId,
  action,
  descricao,
  dadosAnteriores,
  dadosNovos,
  meta,
  ip,
  userAgent,
}: RecordUserAuditEventParams) => {
  const config = getUserHistoryConfig(action);

  await client.auditoriaLogs.create({
    data: {
      categoria: config.auditoriaCategoria,
      tipo: config.tipo,
      acao: action,
      usuarioId: actorId ?? null,
      entidadeId: targetUserId,
      entidadeTipo: 'USUARIO',
      descricao,
      dadosAnteriores: toAuditJson(dadosAnteriores),
      dadosNovos: toAuditJson(dadosNovos),
      metadata: toAuditJson({
        ...(meta ?? {}),
        actorRole: actorRole ?? null,
        origem: meta?.origem ?? 'PAINEL_ADMIN',
      }),
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    },
  });
};

type UserProfileSnapshotInput = {
  id: string;
  nomeCompleto: string | null;
  email: string;
  cpf?: string | null;
  cnpj?: string | null;
  role: Roles | string;
  status: Status | string;
  tipoUsuario?: string | null;
  criadoEm?: Date | string | null;
  atualizadoEm?: Date | string | null;
  emailVerificado?: boolean | null;
  emailVerificadoEm?: Date | string | null;
  UsuariosInformation?: {
    telefone?: string | null;
    genero?: string | null;
    dataNasc?: Date | string | null;
    descricao?: string | null;
    avatarUrl?: string | null;
    inscricao?: string | null;
  } | null;
  UsuariosRedesSociais?: {
    linkedin?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    youtube?: string | null;
    twitter?: string | null;
    tiktok?: string | null;
  } | null;
  UsuariosEnderecos?:
    | {
        logradouro?: string | null;
        numero?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        estado?: string | null;
        cep?: string | null;
      }[]
    | null;
};

const toIsoString = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const buildUserProfileSnapshot = (usuario: UserProfileSnapshotInput) => {
  const endereco = usuario.UsuariosEnderecos?.[0]
    ? {
        logradouro: usuario.UsuariosEnderecos[0].logradouro ?? null,
        numero: usuario.UsuariosEnderecos[0].numero ?? null,
        bairro: usuario.UsuariosEnderecos[0].bairro ?? null,
        cidade: usuario.UsuariosEnderecos[0].cidade ?? null,
        estado: usuario.UsuariosEnderecos[0].estado ?? null,
        cep: usuario.UsuariosEnderecos[0].cep ?? null,
      }
    : null;

  return {
    id: usuario.id,
    nomeCompleto: usuario.nomeCompleto ?? null,
    email: usuario.email,
    cpf: usuario.cpf ?? null,
    cnpj: usuario.cnpj ?? null,
    role: usuario.role,
    status: usuario.status,
    tipoUsuario: usuario.tipoUsuario ?? null,
    telefone: usuario.UsuariosInformation?.telefone ?? null,
    genero: usuario.UsuariosInformation?.genero ?? null,
    dataNasc: toIsoString(usuario.UsuariosInformation?.dataNasc),
    descricao: usuario.UsuariosInformation?.descricao ?? null,
    avatarUrl: usuario.UsuariosInformation?.avatarUrl ?? null,
    inscricao: usuario.UsuariosInformation?.inscricao ?? null,
    endereco,
    redesSociais: usuario.UsuariosRedesSociais
      ? {
          linkedin: usuario.UsuariosRedesSociais.linkedin ?? null,
          instagram: usuario.UsuariosRedesSociais.instagram ?? null,
          facebook: usuario.UsuariosRedesSociais.facebook ?? null,
          youtube: usuario.UsuariosRedesSociais.youtube ?? null,
          twitter: usuario.UsuariosRedesSociais.twitter ?? null,
          tiktok: usuario.UsuariosRedesSociais.tiktok ?? null,
        }
      : null,
    emailVerificado: usuario.emailVerificado ?? null,
    emailVerificadoEm: toIsoString(usuario.emailVerificadoEm),
    criadoEm: toIsoString(usuario.criadoEm),
    atualizadoEm: toIsoString(usuario.atualizadoEm),
  };
};
