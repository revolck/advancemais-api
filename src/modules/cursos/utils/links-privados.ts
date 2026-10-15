import { Roles, StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';

/**
 * Links das aulas e provas (sala do Meet, vídeo, gravação) só para quem tem acesso à turma.
 * Rotas abertas (site, login opcional) devolvem a estrutura sem esses campos.
 */

const CAMPOS_DE_LINK = new Set([
  'urlMeet',
  'meetUrl',
  'urlVideo',
  'youtubeUrl',
  'linkGravacao',
  'meetEventId',
  'meetSpaceName',
]);

/** Dados de pessoas (instrutores, alunos) que rota aberta não devolve */
const CAMPOS_PESSOAIS = new Set(['email', 'cpf', 'telefone', 'endereco', 'alunos']);

const EQUIPE: string[] = [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO];

/** Situações em que o aluno estuda na turma (as mesmas da área do aluno) */
const STATUS_COM_ACESSO: StatusInscricao[] = [
  StatusInscricao.INSCRITO,
  StatusInscricao.EM_ANDAMENTO,
  StatusInscricao.EM_ESTAGIO,
  StatusInscricao.CONCLUIDO,
];

type Usuario = { id?: string | null; role?: string | null } | null | undefined;

const ehObjetoSimples = (valor: unknown): valor is Record<string, unknown> => {
  if (valor === null || typeof valor !== 'object') return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
};

/**
 * Cópia sem dados privados, em qualquer profundidade:
 * - `links`: links das aulas/provas e a URL dos materiais;
 * - `dadosPessoais`: e-mail, CPF, telefone, endereço e lista de alunos.
 */
export function semDadosPrivados<T>(
  dados: T,
  opcoes: { links: boolean; dadosPessoais: boolean },
): T {
  const limpar = (valor: unknown, dentroDeMateriais = false): unknown => {
    if (Array.isArray(valor)) return valor.map((item) => limpar(item, dentroDeMateriais));
    if (!ehObjetoSimples(valor)) return valor;
    const copia: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor)) {
      if (opcoes.links && CAMPOS_DE_LINK.has(chave)) continue;
      if (opcoes.links && dentroDeMateriais && chave === 'url') continue;
      if (opcoes.dadosPessoais && CAMPOS_PESSOAIS.has(chave)) continue;
      copia[chave] = limpar(item, chave === 'materiais');
    }
    return copia;
  };
  return limpar(dados) as T;
}

export const ehEquipe = (usuario: Usuario) =>
  Boolean(usuario?.role && EQUIPE.includes(usuario.role));

/** Equipe e instrutor veem tudo da turma (o instrutor, dentro do escopo dele) */
export const ehEquipeOuInstrutor = (usuario: Usuario) =>
  ehEquipe(usuario) || usuario?.role === Roles.INSTRUTOR;

/** O que a resposta de uma turma pode mostrar para este usuário */
export async function filtrarParaUsuario<T>(
  dados: T,
  usuario: Usuario,
  turmaId: string | null,
): Promise<T> {
  if (ehEquipeOuInstrutor(usuario)) return dados;
  const comAcesso = turmaId ? await podeVerLinksDaTurma(usuario, turmaId) : false;
  return semDadosPrivados(dados, { links: !comAcesso, dadosPessoais: true });
}

/** Equipe, instrutor (o serviço já limita ao escopo dele) ou aluno ativo na turma */
export async function podeVerLinksDaTurma(usuario: Usuario, turmaId: string): Promise<boolean> {
  if (!usuario?.id || !usuario.role) return false;
  if (ehEquipe(usuario) || usuario.role === Roles.INSTRUTOR) return true;
  if (usuario.role !== Roles.ALUNO_CANDIDATO) return false;
  const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
    where: {
      turmaId,
      alunoId: usuario.id,
      statusPagamento: 'APROVADO',
      removidaEm: null,
      status: { in: STATUS_COM_ACESSO },
    },
    select: { id: true },
  });
  return Boolean(inscricao);
}
