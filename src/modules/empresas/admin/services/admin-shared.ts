import type { Prisma } from '@prisma/client';

import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { mapSocialLinks, usuarioRedesSociaisSelect } from '@/modules/usuarios/utils/social-links';

const usuarioEnderecoSelect = {
  orderBy: { criadoEm: 'asc' },
  select: {
    id: true,
    logradouro: true,
    numero: true,
    bairro: true,
    cidade: true,
    estado: true,
    cep: true,
  },
} as const;

export const usuarioAdminSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  email: true,
  cpf: true,
  cnpj: true,
  role: true,
  tipoUsuario: true,
  status: true,
  criadoEm: true,
  ultimoLogin: true,
  ...usuarioRedesSociaisSelect,
  informacoes: { select: usuarioInformacoesSelect },
  enderecos: usuarioEnderecoSelect,
} satisfies Prisma.UsuariosSelect;

export const curriculoSelect = {
  id: true,
  usuarioId: true,
  titulo: true,
  resumo: true,
  objetivo: true,
  principal: true,
  areasInteresse: true,
  preferencias: true,
  habilidades: true,
  idiomas: true,
  experiencias: true,
  formacao: true,
  cursosCertificacoes: true,
  premiosPublicacoes: true,
  acessibilidade: true,
  consentimentos: true,
  ultimaAtualizacao: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.UsuariosCurriculosSelect;

export type UsuarioAdminRecord = Prisma.UsuariosGetPayload<{ select: typeof usuarioAdminSelect }>;
export type CurriculoRecord = Prisma.UsuariosCurriculosGetPayload<{ select: typeof curriculoSelect }>;

export const mapUsuarioAdmin = (usuario?: UsuarioAdminRecord | null) => {
  if (!usuario) {
    return null;
  }

  const merged = attachEnderecoResumo(mergeUsuarioInformacoes(usuario));

  if (!merged) {
    return null;
  }

  const socialLinks = mapSocialLinks(merged.redesSociais);

  return {
    id: merged.id,
    codUsuario: merged.codUsuario,
    nomeCompleto: merged.nomeCompleto,
    email: merged.email,
    cpf: merged.cpf ?? null,
    cnpj: merged.cnpj ?? null,
    role: merged.role,
    tipoUsuario: merged.tipoUsuario,
    status: merged.status,
    criadoEm: merged.criadoEm,
    ultimoLogin: merged.ultimoLogin ?? null,
    telefone: merged.telefone ?? null,
    genero: merged.genero ?? null,
    dataNasc: merged.dataNasc ?? null,
    inscricao: merged.inscricao ?? null,
    avatarUrl: merged.avatarUrl ?? null,
    descricao: merged.descricao ?? null,
    aceitarTermos: merged.aceitarTermos ?? false,
    cidade: merged.cidade,
    estado: merged.estado,
    enderecos: merged.enderecos,
    socialLinks,
    informacoes: merged.informacoes,
  };
};

export const mapCurriculo = (curriculo?: CurriculoRecord | null) => {
  if (!curriculo) {
    return null;
  }

  return {
    id: curriculo.id,
    usuarioId: curriculo.usuarioId,
    titulo: curriculo.titulo ?? null,
    resumo: curriculo.resumo ?? null,
    objetivo: curriculo.objetivo ?? null,
    principal: curriculo.principal,
    areasInteresse: curriculo.areasInteresse ?? null,
    preferencias: curriculo.preferencias ?? null,
    habilidades: curriculo.habilidades ?? null,
    idiomas: curriculo.idiomas ?? null,
    experiencias: curriculo.experiencias ?? null,
    formacao: curriculo.formacao ?? null,
    cursosCertificacoes: curriculo.cursosCertificacoes ?? null,
    premiosPublicacoes: curriculo.premiosPublicacoes ?? null,
    acessibilidade: curriculo.acessibilidade ?? null,
    consentimentos: curriculo.consentimentos ?? null,
    ultimaAtualizacao: curriculo.ultimaAtualizacao,
    criadoEm: curriculo.criadoEm,
    atualizadoEm: curriculo.atualizadoEm,
  };
};
