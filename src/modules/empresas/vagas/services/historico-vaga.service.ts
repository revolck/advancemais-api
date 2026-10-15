import { Roles, type StatusDeVagas } from '@prisma/client';
import { prisma } from '@/config/prisma';

const PAPEIS_DA_EQUIPE: string[] = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];

export interface EntradaHistoricoVaga {
  id: string;
  acao: string;
  descricao: string;
  de: StatusDeVagas | null;
  para: StatusDeVagas | null;
  criadoEm: string;
  /** null = não registrado (ações de antes do histórico existir) */
  autor: { nome: string; papel: string } | null;
  detalhes: { motivoRejeicao?: string; observacoes?: string; campos?: string[] };
  /** HISTORICO = registro completo; NOTIFICACAO/CADASTRO = reconstruído (sem autor) */
  origem: 'HISTORICO' | 'NOTIFICACAO' | 'CADASTRO';
}

const statusDe = (json: unknown): StatusDeVagas | null =>
  json && typeof json === 'object' && 'status' in json
    ? ((json as { status?: StatusDeVagas }).status ?? null)
    : null;

const texto = (json: unknown, chave: string): string | undefined => {
  if (!json || typeof json !== 'object') return undefined;
  const valor = (json as Record<string, unknown>)[chave];
  return typeof valor === 'string' && valor.trim() ? valor : undefined;
};

/**
 * Histórico da vaga para o painel. Equipe (admin, moderador, setor de vagas) vê tudo,
 * com o nome de quem fez. A empresa dona vê o histórico da própria vaga; ações da equipe
 * aparecem como "Setor de vagas" (sem expor o nome do funcionário).
 */
export async function listarHistoricoDaVaga(
  vagaId: string,
  leitor: { id: string; role?: string | null },
): Promise<EntradaHistoricoVaga[]> {
  const vaga = await prisma.empresasVagas.findUnique({
    where: { id: vagaId },
    select: {
      id: true,
      usuarioId: true,
      inseridaEm: true,
      Usuarios: { select: { nomeCompleto: true } },
    },
  });

  const leitorEhEmpresa = leitor.role === Roles.EMPRESA;
  if (!vaga || (leitorEhEmpresa && vaga.usuarioId !== leitor.id)) {
    throw Object.assign(new Error('Vaga não encontrada'), {
      code: 'VAGA_NOT_FOUND',
      statusCode: 404,
    });
  }

  const autorParaLeitor = (
    usuario: { id: string; nomeCompleto: string; role: string } | null,
  ): EntradaHistoricoVaga['autor'] => {
    if (!usuario) return null;
    if (!leitorEhEmpresa) return { nome: usuario.nomeCompleto, papel: usuario.role };
    if (usuario.id === vaga.usuarioId) return { nome: usuario.nomeCompleto, papel: 'EMPRESA' };
    if (PAPEIS_DA_EQUIPE.includes(usuario.role)) return { nome: 'Setor de vagas', papel: 'EQUIPE' };
    return { nome: usuario.nomeCompleto, papel: usuario.role };
  };

  const registros = await prisma.auditoriaLogs.findMany({
    where: { entidadeTipo: 'VAGA', entidadeId: vagaId },
    orderBy: { criadoEm: 'desc' },
    take: 200,
    select: {
      id: true,
      acao: true,
      descricao: true,
      dadosAnteriores: true,
      dadosNovos: true,
      metadata: true,
      criadoEm: true,
      Usuarios: { select: { id: true, nomeCompleto: true, role: true } },
    },
  });

  const entradas: EntradaHistoricoVaga[] = registros.map((r) => {
    const campos = (r.metadata as { campos?: unknown } | null)?.campos;
    return {
      id: r.id,
      acao: r.acao,
      descricao: r.descricao,
      de: statusDe(r.dadosAnteriores),
      para: statusDe(r.dadosNovos),
      criadoEm: r.criadoEm.toISOString(),
      autor: autorParaLeitor(r.Usuarios),
      detalhes: {
        motivoRejeicao: texto(r.metadata, 'motivoRejeicao'),
        observacoes: texto(r.metadata, 'observacoes'),
        campos: Array.isArray(campos) ? campos.filter((c) => typeof c === 'string') : undefined,
      },
      origem: 'HISTORICO',
    };
  });

  // Antes do histórico existir, aprovações e rejeições só ficaram nas notificações
  const inicioDoHistorico = registros.length ? registros[registros.length - 1].criadoEm : undefined;
  const notificacoes = await prisma.notificacoes.findMany({
    where: {
      vagaId,
      tipo: { in: ['VAGA_APROVADA', 'VAGA_REJEITADA'] },
      ...(inicioDoHistorico ? { criadoEm: { lt: inicioDoHistorico } } : {}),
    },
    select: { id: true, tipo: true, criadoEm: true, dados: true },
  });
  for (const n of notificacoes) {
    const aprovada = n.tipo === 'VAGA_APROVADA';
    entradas.push({
      id: `notificacao-${n.id}`,
      acao: aprovada ? 'VAGA_APROVADA' : 'VAGA_REJEITADA',
      descricao: aprovada
        ? 'Vaga aprovada e publicada pelo setor de vagas'
        : 'Vaga rejeitada pelo setor de vagas',
      de: 'EM_ANALISE',
      para: aprovada ? 'PUBLICADO' : 'RASCUNHO',
      criadoEm: n.criadoEm.toISOString(),
      autor: null,
      detalhes: {
        motivoRejeicao: texto(n.dados, 'motivoRejeicao'),
        observacoes: texto(n.dados, 'observacoes'),
      },
      origem: 'NOTIFICACAO',
    });
  }

  if (!entradas.some((e) => e.acao === 'VAGA_CRIADA')) {
    entradas.push({
      id: `cadastro-${vaga.id}`,
      acao: 'VAGA_CRIADA',
      descricao: 'Vaga cadastrada',
      de: null,
      para: null,
      criadoEm: vaga.inseridaEm.toISOString(),
      autor: null,
      detalhes: {},
      origem: 'CADASTRO',
    });
  }

  return entradas.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
