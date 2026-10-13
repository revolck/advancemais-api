import { prisma } from '@/config/prisma';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { BrevoClient } from '../client/brevo-client';
import {
  RESULTADOS_VALIDACAO,
  carregarValidacoes,
  criarValidadorExterno,
  detectarErroDeDigitacao,
  liberadoParaEnvio,
  normalizarEmail,
  precisaValidar,
  type RegistroValidacao,
  type ResultadoValidacao,
} from '../validacao';
import {
  COMUNICADO_PRIMEIRO_ACESSO,
  MAX_TENTATIVAS,
  MAX_TENTATIVAS_DEVOLUCAO_TEMPORARIA,
  avaliarTaxaDevolucao,
  contagemJanela,
  filtroElegiveis,
  filtroPopulacao,
  inicioDoDiaBrasilia,
  inicioJanelaDevolucao,
  limiteDiarioRampa,
  previsaoFimDaPausa,
  situacaoRampa,
} from './primeiro-acesso.service';
import { getEstadoExecucao, RESERVA_CREDITOS_BREVO } from './primeiro-acesso.cron';

// ---------------------------------------------------------------------------
// Pendências (alunos que precisam de correção ou revisão)
// ---------------------------------------------------------------------------

export const TIPOS_PENDENCIA = [
  'SENHA_POSSIVELMENTE_EXPOSTA',
  'EMAIL_DEVOLVIDO',
  'SENHA_REVOGADA',
  'ENVIO_INCERTO',
  'FALHA_NO_ENVIO',
  'DEVOLUCAO_TEMPORARIA_PERSISTENTE',
  'EMAIL_INVALIDO',
  'EMAIL_BLOQUEADO',
  'EMAIL_DE_RISCO',
  'VALIDACAO_INCONCLUSIVA',
] as const;
export type TipoPendencia = (typeof TIPOS_PENDENCIA)[number];

/** Pendências em que o aluno ficou com uma senha provisória que não recebeu */
const SENHA_NAO_RECEBIDA: TipoPendencia[] = ['EMAIL_DEVOLVIDO', 'ENVIO_INCERTO', 'SENHA_REVOGADA'];

interface EnvioResumo {
  status: string;
  email: string;
  tentativas: number;
  erro: string | null;
}

export interface Pendencia {
  tipo: TipoPendencia;
  motivo: string;
  sugestao: string | null;
}

/** O que impede (ou impediu) o aluno de receber o comunicado com segurança */
export function classificarPendencia(
  usuario: { email: string; precisaTrocarSenha: boolean },
  envio: EnvioResumo | undefined,
  validacao: RegistroValidacao | undefined,
): Pendencia | null {
  if (envio) {
    switch (envio.status) {
      case 'ENVIADO': {
        const [local, dominio = ''] = envio.email.split('@');
        const provavel = detectarErroDeDigitacao(dominio);
        if (provavel && usuario.precisaTrocarSenha) {
          return {
            tipo: 'SENHA_POSSIVELMENTE_EXPOSTA',
            motivo: `Entregue no domínio "${dominio}", provável erro de digitação: a senha provisória pode estar com terceiros.`,
            sugestao: `${local}@${provavel}`,
          };
        }
        return null;
      }
      case 'DEVOLVIDO':
        return {
          tipo: 'EMAIL_DEVOLVIDO',
          motivo: envio.erro ?? 'Devolução definitiva',
          sugestao: null,
        };
      case 'REVOGADO':
        return {
          tipo: 'SENHA_REVOGADA',
          motivo: envio.erro ?? 'Senha provisória revogada',
          sugestao: null,
        };
      case 'INCERTO':
        return {
          tipo: 'ENVIO_INCERTO',
          motivo: envio.erro ?? 'Não foi possível confirmar o envio',
          sugestao: null,
        };
      case 'FALHA':
        return envio.tentativas >= MAX_TENTATIVAS
          ? { tipo: 'FALHA_NO_ENVIO', motivo: envio.erro ?? 'Falha no envio', sugestao: null }
          : null;
      case 'DEVOLUCAO_TEMPORARIA':
        return envio.tentativas >= MAX_TENTATIVAS_DEVOLUCAO_TEMPORARIA
          ? {
              tipo: 'DEVOLUCAO_TEMPORARIA_PERSISTENTE',
              motivo: envio.erro ?? 'Caixa indisponível',
              sugestao: null,
            }
          : null;
      case 'DESCARTADO':
        return {
          tipo: 'EMAIL_INVALIDO',
          motivo: envio.erro ?? 'Domínio não recebe e-mail',
          sugestao: null,
        };
      default:
      // PROCESSANDO e REABERTO: vale a validação do e-mail atual
    }
  }

  if (!validacao) return null;
  const base = { motivo: validacao.motivo ?? validacao.resultado, sugestao: validacao.sugestao };
  switch (validacao.resultado) {
    case 'INVALIDO':
      return { tipo: 'EMAIL_INVALIDO', ...base };
    case 'BLOQUEADO':
      return { tipo: 'EMAIL_BLOQUEADO', ...base };
    case 'RISCO':
      return { tipo: 'EMAIL_DE_RISCO', ...base };
    case 'DESCONHECIDO':
      return { tipo: 'VALIDACAO_INCONCLUSIVA', ...base };
    default:
      return null;
  }
}

export const mascararCpf = (cpf: string | null) => {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  return digitos.length === 11 ? `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**` : null;
};

async function carregarBase() {
  const [usuarios, envios] = await Promise.all([
    prisma.usuarios.findMany({
      where: filtroPopulacao(),
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cpf: true,
        precisaTrocarSenha: true,
        UsuariosInformation: { select: { telefone: true } },
      },
      orderBy: { nomeCompleto: 'asc' },
    }),
    prisma.comunicadosEnvios.findMany({
      where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO },
      select: {
        usuarioId: true,
        email: true,
        status: true,
        tentativas: true,
        erro: true,
        enviadoEm: true,
        entregueEm: true,
        devolvidoEm: true,
      },
    }),
  ]);
  const validacoes = await carregarValidacoes(usuarios.map((u) => u.email));
  return { usuarios, envios: new Map(envios.map((e) => [e.usuarioId, e])), validacoes };
}

export async function listarPendencias(params: {
  tipo?: TipoPendencia;
  busca?: string;
  page?: number;
  pageSize?: number;
}) {
  const { usuarios, envios, validacoes } = await carregarBase();
  const todas = usuarios.flatMap((usuario) => {
    const pendencia = classificarPendencia(
      usuario,
      envios.get(usuario.id),
      validacoes.get(normalizarEmail(usuario.email)),
    );
    if (!pendencia) return [];
    return [
      {
        usuarioId: usuario.id,
        nomeCompleto: usuario.nomeCompleto,
        email: usuario.email,
        cpf: mascararCpf(usuario.cpf),
        telefone: usuario.UsuariosInformation?.telefone ?? null,
        ...pendencia,
        senhaProvisoriaNaoRecebida:
          SENHA_NAO_RECEBIDA.includes(pendencia.tipo) && usuario.precisaTrocarSenha,
        statusEnvio: envios.get(usuario.id)?.status ?? null,
      },
    ];
  });

  const porTipo = Object.fromEntries(TIPOS_PENDENCIA.map((tipo) => [tipo, 0])) as Record<
    TipoPendencia,
    number
  >;
  todas.forEach((item) => (porTipo[item.tipo] += 1));

  const porId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const termo = params.busca?.trim().toLowerCase() ?? '';
  const digitos = termo.replace(/\D/g, '');
  const filtradas = todas.filter((item) => {
    if (params.tipo && item.tipo !== params.tipo) return false;
    if (!termo) return true;
    const usuario = porId.get(item.usuarioId);
    return (
      item.nomeCompleto.toLowerCase().includes(termo) ||
      item.email.toLowerCase().includes(termo) ||
      (digitos.length >= 3 && (usuario?.cpf ?? '').replace(/\D/g, '').includes(digitos))
    );
  });

  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  return {
    total: filtradas.length,
    page,
    pageSize,
    porTipo,
    itens: filtradas.slice((page - 1) * pageSize, page * pageSize),
  };
}

// ---------------------------------------------------------------------------
// Situação da campanha (motivo da pausa e condições para retomar)
// ---------------------------------------------------------------------------

export interface EntradaSituacao {
  ativo: boolean;
  restantes: number;
  prontosParaEnvio: number;
  aguardandoValidacao: number;
  temValidador: boolean;
  sincronizacaoOk: boolean | null;
  taxa: { pausado: boolean; taxaPercentual: number; limite: number; previsaoFim: Date | null };
  rampa: { disponivelHoje: number; limiteHoje: number; limiteAmanha: number };
  creditosDisponiveis: number | null;
}

export interface Situacao {
  codigo: string;
  titulo: string;
  detalhe: string;
  condicoesRetomada: string[];
}

const formatarDataHora = (data: Date) =>
  data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });

/** Todas as situações que impedem o envio, da mais grave para a mais leve */
export function avaliarSituacao(e: EntradaSituacao): Situacao[] {
  const situacoes: Situacao[] = [];
  if (e.restantes === 0) {
    return [
      {
        codigo: 'CONCLUIDO',
        titulo: 'Campanha concluída',
        detalhe:
          'Todos os alunos com e-mail já foram atendidos. Restam só as pendências de correção.',
        condicoesRetomada: [],
      },
    ];
  }
  if (e.sincronizacaoOk === false) {
    situacoes.push({
      codigo: 'FALHA_SINCRONIZACAO_BREVO',
      titulo: 'Parado: sem resposta da Brevo',
      detalhe:
        'Sem a lista de devoluções e bloqueios da Brevo o envio não continua, para não repetir endereços ruins.',
      condicoesRetomada: [
        'A consulta à Brevo voltar a funcionar (chave de API válida e IP do servidor autorizado na Brevo).',
      ],
    });
  }
  if (e.taxa.pausado) {
    situacoes.push({
      codigo: 'TAXA_DEVOLUCAO_ALTA',
      titulo: 'Pausado: muitas devoluções',
      detalhe: `Devolução de ${e.taxa.taxaPercentual}% nas últimas 24h (limite ${e.taxa.limite}%).`,
      condicoesRetomada: [
        `Retoma sozinho quando a taxa das últimas 24h ficar em até ${e.taxa.limite}%${
          e.taxa.previsaoFim
            ? ` (previsão: ${formatarDataHora(e.taxa.previsaoFim)}, sem novos envios)`
            : ''
        }.`,
        'Antes de retomar, valide a lista: só endereços confirmados pelo validador são enviados.',
      ],
    });
  }
  if (!e.temValidador && e.prontosParaEnvio === 0) {
    situacoes.push({
      codigo: 'SEM_VALIDADOR',
      titulo: 'Aguardando validador de e-mails',
      detalhe:
        'Nenhum endereço novo é enviado sem confirmação de que a caixa postal existe. Checar formato e domínio não basta.',
      condicoesRetomada: [
        'Configurar "Validador de e-mails" (zerobounce, neverbounce ou kickbox) e a chave de API em Configurações → E-mails.',
        'Rodar "Validar fila" e conferir os resultados antes de ligar o envio.',
      ],
    });
  }
  if (e.creditosDisponiveis === null) {
    situacoes.push({
      codigo: 'COTA_BREVO_DESCONHECIDA',
      titulo: 'Parado: créditos da Brevo desconhecidos',
      detalhe: 'Não foi possível ler os créditos do plano na Brevo.',
      condicoesRetomada: ['A Brevo voltar a informar os créditos em /account.'],
    });
  } else if (e.creditosDisponiveis <= 0) {
    situacoes.push({
      codigo: 'COTA_BREVO_INSUFICIENTE',
      titulo: 'Parado: créditos da Brevo no fim',
      detalhe: `Os últimos ${RESERVA_CREDITOS_BREVO} créditos ficam reservados para os e-mails do sistema.`,
      condicoesRetomada: ['Renovação do plano ou compra de créditos na Brevo.'],
    });
  }
  if (!e.ativo) {
    situacoes.push({
      codigo: 'DESLIGADO',
      titulo: 'Envio automático desligado',
      detalhe: `${e.prontosParaEnvio} aluno(s) com e-mail validado aguardando envio.`,
      condicoesRetomada: [
        'Ligar "Envio do comunicado de primeiro acesso" em Configurações → E-mails.',
      ],
    });
  }
  if (e.rampa.disponivelHoje <= 0) {
    situacoes.push({
      codigo: 'LIMITE_DIARIO_RAMPA',
      titulo: 'Limite de hoje atingido',
      detalhe: `Aquecimento: ${e.rampa.limiteHoje} envios hoje.`,
      condicoesRetomada: [
        `Retoma amanhã às 00:00 (Brasília) com limite de ${e.rampa.limiteAmanha}.`,
      ],
    });
  }
  if (e.prontosParaEnvio === 0 && e.temValidador) {
    situacoes.push(
      e.aguardandoValidacao > 0
        ? {
            codigo: 'AGUARDANDO_VALIDACAO',
            titulo: 'Validando endereços',
            detalhe: `${e.aguardandoValidacao} endereço(s) aguardando o validador.`,
            condicoesRetomada: ['Os envios saem conforme os endereços forem confirmados.'],
          }
        : {
            codigo: 'AGUARDANDO_CORRECOES',
            titulo: 'Só restam pendências',
            detalhe: 'Os alunos restantes precisam de correção de e-mail ou revisão manual.',
            condicoesRetomada: ['Corrigir os e-mails na lista de pendências.'],
          },
    );
  }
  if (situacoes.length === 0) {
    situacoes.push({
      codigo: 'EM_ANDAMENTO',
      titulo: 'Enviando',
      detalhe: `${e.prontosParaEnvio} aluno(s) validado(s) na fila; até ${e.rampa.disponivelHoje} envio(s) ainda hoje.`,
      condicoesRetomada: [],
    });
  }
  return situacoes;
}

export async function obterPainel(agora = new Date()) {
  const [config, validacaoConfig, base, elegiveis, janela] = await Promise.all([
    runtimeConfigService.getComunicadoPrimeiroAcessoConfig(),
    runtimeConfigService.getEmailValidacaoConfig(),
    carregarBase(),
    prisma.usuarios.findMany({ where: filtroElegiveis(agora), select: { id: true, email: true } }),
    contagemJanela(inicioJanelaDevolucao(agora)),
  ]);
  const rampa = await situacaoRampa(config, agora);
  const estado = getEstadoExecucao();
  const temValidador = Boolean(
    criarValidadorExterno(validacaoConfig.provedor, validacaoConfig.apiKey),
  );
  const { usuarios, envios, validacoes } = base;

  // Validação dos e-mails de quem ainda está na fila
  const validacao = Object.fromEntries(
    [...RESULTADOS_VALIDACAO, 'SEM_VALIDACAO'].map((r) => [r, 0]),
  ) as Record<ResultadoValidacao | 'SEM_VALIDACAO', number>;
  let prontosParaEnvio = 0;
  let aguardandoValidacao = 0;
  for (const elegivel of elegiveis) {
    const registro = validacoes.get(normalizarEmail(elegivel.email));
    validacao[registro ? (registro.resultado as ResultadoValidacao) : 'SEM_VALIDACAO'] += 1;
    if (liberadoParaEnvio(registro, agora)) prontosParaEnvio += 1;
    else if (precisaValidar(registro, agora, true)) aguardandoValidacao += 1;
  }

  // Envios
  const listaEnvios = [...envios.values()];
  const porStatus: Record<string, number> = {};
  listaEnvios.forEach((e) => (porStatus[e.status] = (porStatus[e.status] ?? 0) + 1));
  const realizados = listaEnvios.filter((e) => e.enviadoEm).length;
  const devolvidosDefinitivos = listaEnvios.filter((e) => e.devolvidoEm).length;

  let precisamCorrecao = 0;
  let senhasPossivelmenteExpostas = 0;
  for (const usuario of usuarios) {
    const pendencia = classificarPendencia(
      usuario,
      envios.get(usuario.id),
      validacoes.get(normalizarEmail(usuario.email)),
    );
    if (pendencia) precisamCorrecao += 1;
    if (pendencia?.tipo === 'SENHA_POSSIVELMENTE_EXPOSTA') senhasPossivelmenteExpostas += 1;
  }

  let creditosBrevo: number | null = null;
  let erroCreditos: string | null = null;
  try {
    creditosBrevo = await BrevoClient.getInstance().obterCreditosEnvio();
  } catch (error) {
    erroCreditos = error instanceof Error ? error.message.slice(0, 200) : 'Erro ao consultar';
  }
  const creditosDisponiveis =
    creditosBrevo === null ? null : creditosBrevo - RESERVA_CREDITOS_BREVO;

  const taxa24h = avaliarTaxaDevolucao(janela, config.maxDevolucao);
  const previsaoFim = taxa24h.pausado ? await previsaoFimDaPausa(config.maxDevolucao, agora) : null;
  const situacoes = avaliarSituacao({
    ativo: config.ativo,
    restantes: elegiveis.length,
    prontosParaEnvio,
    aguardandoValidacao,
    temValidador,
    sincronizacaoOk: estado.ultimaSincronizacao?.ok ?? null,
    taxa: { ...taxa24h, limite: config.maxDevolucao, previsaoFim },
    rampa: {
      ...rampa,
      limiteAmanha: limiteDiarioRampa(
        config.rampaInicial,
        config.maxDiario,
        rampa.diasComEnvio + (rampa.enviadosHoje > 0 ? 1 : 0),
      ),
    },
    creditosDisponiveis,
  });

  return {
    comunicado: COMUNICADO_PRIMEIRO_ACESSO,
    geradoEm: agora.toISOString(),
    situacao: situacoes[0],
    alertas: situacoes.slice(1),
    configuracao: {
      ativo: config.ativo,
      lotePorCiclo: config.lote,
      maxDevolucao: config.maxDevolucao,
      rampaInicial: config.rampaInicial,
      maxDiario: config.maxDiario,
      validador: validacaoConfig.provedor,
      validadorConfigurado: temValidador,
    },
    totalAlunos: usuarios.length,
    fila: {
      restantes: elegiveis.length,
      prontosParaEnvio,
      aguardandoValidacao,
      precisamCorrecao,
      senhasPossivelmenteExpostas,
    },
    validacao,
    envios: {
      realizados,
      entregues: listaEnvios.filter((e) => e.entregueEm).length,
      devolvidosDefinitivos,
      devolvidosTemporarios: porStatus.DEVOLUCAO_TEMPORARIA ?? 0,
      falhas: porStatus.FALHA ?? 0,
      incertos: porStatus.INCERTO ?? 0,
      reabertos: porStatus.REABERTO ?? 0,
      revogados: porStatus.REVOGADO ?? 0,
      emProcessamento: porStatus.PROCESSANDO ?? 0,
      porStatus,
    },
    devolucao: {
      ultimas24h: { ...taxa24h, previsaoFim: previsaoFim?.toISOString() ?? null },
      total: avaliarTaxaDevolucao(
        { enviados: realizados, devolvidos: devolvidosDefinitivos },
        config.maxDevolucao,
      ),
      limite: config.maxDevolucao,
    },
    rampa: { ...rampa, inicioDoDia: inicioDoDiaBrasilia(agora).toISOString() },
    brevo: {
      creditos: creditosBrevo,
      reserva: RESERVA_CREDITOS_BREVO,
      disponiveisParaComunicado: creditosDisponiveis,
      erro: erroCreditos,
    },
    execucao: estado,
  };
}
