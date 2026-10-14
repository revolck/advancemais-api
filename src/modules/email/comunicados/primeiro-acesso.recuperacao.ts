import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { MAX_CURRICULOS } from '@/modules/candidatos/curriculos/services';
import { situacaoDaEmpresa } from '@/modules/empresas/bonificacao/bonificacao-inauguracao.service';
import { EmailDispatcher } from '../client/email-dispatcher';
import type { EmailSendResult } from '../client/types';
import { EmailConfigManager } from '../config/email-config';
import { EmailTemplates } from '../templates/email-templates';
import {
  carregarValidacoes,
  ehBloqueioDefinitivo,
  normalizarEmail,
  verificarLocalmente,
} from '../validacao';
import {
  COMUNICADO_PRIMEIRO_ACESSO,
  TAG_COMUNICADO,
  filtroPopulacao,
  montarLinks,
} from './primeiro-acesso.service';

/**
 * Primeiro acesso pelo próprio aluno: em "Esqueci minha senha" ele informa o CPF e
 * recebe o link no e-mail do cadastro. Como é o aluno quem pede, só gera envio para
 * quem acredita ter acesso àquele e-mail (sem disparo em massa e sem custo).
 */

const log = logger.child({ module: 'PrimeiroAcessoRecuperacao' });

export interface DecisaoEnvioRecuperacao {
  permitido: boolean;
  codigo?: 'SEM_EMAIL_CADASTRADO' | 'EMAIL_NAO_RECEBE';
  mensagem?: string;
}

const SEM_EMAIL: DecisaoEnvioRecuperacao = {
  permitido: false,
  codigo: 'SEM_EMAIL_CADASTRADO',
  mensagem:
    'Seu cadastro ainda não tem um e-mail válido. Fale com o suporte para cadastrar seu e-mail e acessar a plataforma.',
};

const NAO_RECEBE: DecisaoEnvioRecuperacao = {
  permitido: false,
  codigo: 'EMAIL_NAO_RECEBE',
  mensagem:
    'O e-mail do seu cadastro não está recebendo mensagens. Fale com o suporte para atualizá-lo.',
};

/**
 * Não envia o link para endereço sabidamente ruim: fictício da migração, devolvido ou
 * bloqueado na Brevo, formato inválido, domínio sem e-mail ou com erro de digitação
 * (que pode pertencer a terceiros).
 */
export async function verificarEnvioRecuperacao(email: string): Promise<DecisaoEnvioRecuperacao> {
  const normalizado = normalizarEmail(email);
  if (!normalizado || normalizado.endsWith('@sem-email.local')) return SEM_EMAIL;

  const registro = (await carregarValidacoes([normalizado])).get(normalizado);
  if (registro) {
    if (ehBloqueioDefinitivo(registro) || registro.resultado === 'INVALIDO') return NAO_RECEBE;
    if (registro.resultado === 'BLOQUEADO') return NAO_RECEBE;
    if (registro.resultado === 'RISCO' && registro.motivo === 'DOMINIO_COM_ERRO_DE_DIGITACAO') {
      return NAO_RECEBE;
    }
  }

  // Descartáveis (caixa pública) e domínios com erro de digitação também ficam de fora:
  // o link daria acesso à conta para quem lê aquela caixa
  const local = await verificarLocalmente(normalizado);
  if (local && local.resultado !== 'TEMPORARIO') return NAO_RECEBE;
  return { permitido: true };
}

/** "al***@gmail.com": mostra ao aluno para onde o link foi, sem expor o endereço */
export function mascararEmail(email: string): string {
  const [local = '', dominio = ''] = normalizarEmail(email).split('@');
  return `${local.slice(0, 2)}***@${dominio}`;
}

// ---------------------------------------------------------------------------
// Públicos do primeiro acesso: alunos e empresas importados
// ---------------------------------------------------------------------------

export const COMUNICADO_PRIMEIRO_ACESSO_EMPRESAS = 'PRIMEIRO_ACESSO_EMPRESAS_2026';
export type PublicoPrimeiroAcesso = 'ALUNO' | 'EMPRESA';

/** Empresas importadas da base antiga, ativas e com e-mail real */
export function filtroPopulacaoEmpresas(): Prisma.UsuariosWhereInput {
  return {
    role: 'EMPRESA',
    status: 'ATIVO',
    authId: { startsWith: 'migracao-empresa-' },
    NOT: { email: { endsWith: '@sem-email.local' } },
  };
}

const PUBLICOS: Record<
  PublicoPrimeiroAcesso,
  { comunicado: string; filtro: () => Prisma.UsuariosWhereInput; quem: string }
> = {
  ALUNO: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, filtro: filtroPopulacao, quem: 'Aluno' },
  EMPRESA: {
    comunicado: COMUNICADO_PRIMEIRO_ACESSO_EMPRESAS,
    filtro: filtroPopulacaoEmpresas,
    quem: 'Empresa',
  },
};

async function publicoDoUsuario(
  usuarioId: string,
): Promise<{ publico: PublicoPrimeiroAcesso; email: string } | null> {
  for (const publico of ['ALUNO', 'EMPRESA'] as const) {
    const usuario = await prisma.usuarios.findFirst({
      where: { id: usuarioId, ...PUBLICOS[publico].filtro() },
      select: { email: true },
    });
    if (usuario) return { publico, email: usuario.email };
  }
  return null;
}

/**
 * Abriu o link e definiu a própria senha: o e-mail funciona e o usuário já tem acesso.
 * Sai da fila do comunicado (que trocaria a senha por uma provisória) e o endereço fica
 * registrado como válido. Nunca derruba a redefinição.
 */
export async function registrarAcessoPeloAluno(usuarioId: string): Promise<void> {
  try {
    const encontrado = await publicoDoUsuario(usuarioId);
    if (!encontrado) return;
    const { comunicado, quem } = PUBLICOS[encontrado.publico];
    const email = normalizarEmail(encontrado.email);
    const agora = new Date();

    const chave = { comunicado_usuarioId: { comunicado, usuarioId } };
    const atual = await prisma.comunicadosEnvios.findUnique({
      where: chave,
      select: { status: true },
    });
    if (atual?.status !== 'PROCESSANDO') {
      const dados = {
        email,
        status: 'CONCLUIDO_PELO_ALUNO',
        erro: `${quem} definiu a própria senha pela recuperação de senha`,
      };
      await prisma.comunicadosEnvios.upsert({
        where: chave,
        create: { comunicado, usuarioId, tentativas: 0, ...dados },
        update: dados,
      });
    }

    const registro = (await carregarValidacoes([email])).get(email);
    if (!registro || !ehBloqueioDefinitivo(registro)) {
      const validacao = {
        resultado: 'VALIDO',
        fonte: 'PLATAFORMA',
        motivo: 'LINK_DE_RECUPERACAO_USADO_PELO_ALUNO',
        validadoEm: agora,
        proximaTentativaEm: null,
      };
      await prisma.emailsValidacoes.upsert({
        where: { email },
        create: { email, ...validacao },
        update: validacao,
      });
    }
  } catch (error) {
    log.error({ err: error, usuarioId }, '⚠️ Não foi possível registrar o primeiro acesso');
  }
}

/** Alias com nome neutro (vale para alunos e empresas) */
export const registrarPrimeiroAcessoConcluido = registrarAcessoPeloAluno;

// ---------------------------------------------------------------------------
// Boas-vindas no primeiro pedido de recuperação (aluno ou empresa importados)
// ---------------------------------------------------------------------------

/**
 * Importado que ainda não fez o primeiro acesso recebe o e-mail de boas-vindas (com o
 * link de criar senha) em vez do e-mail padrão de recuperação. Depois que cria a senha
 * (CONCLUIDO_PELO_ALUNO) ou entra na plataforma, volta a receber o padrão. Quem se
 * cadastrou sozinho nunca entra aqui. Retorna o público ou null (e-mail padrão).
 */
export async function publicoBoasVindas(usuarioId: string): Promise<PublicoPrimeiroAcesso | null> {
  for (const publico of ['ALUNO', 'EMPRESA'] as const) {
    const { comunicado, filtro } = PUBLICOS[publico];
    const usuario = await prisma.usuarios.findFirst({
      where: { id: usuarioId, ...filtro(), ultimoLogin: null },
      select: { ComunicadosEnvios: { where: { comunicado }, select: { status: true } } },
    });
    if (usuario) {
      return usuario.ComunicadosEnvios[0]?.status === 'CONCLUIDO_PELO_ALUNO' ? null : publico;
    }
  }
  return null;
}

/** Compatível com a versão só de alunos */
export async function deveEnviarBoasVindas(usuarioId: string): Promise<boolean> {
  return (await publicoBoasVindas(usuarioId)) !== null;
}

async function montarEmailBoasVindas(
  usuario: {
    id: string;
    email: string;
    nomeCompleto: string;
    cpf: string | null;
    cnpj?: string | null;
  },
  linkCriarSenha: string,
  validadeHoras: number,
  publico: PublicoPrimeiroAcesso,
) {
  const links = await montarLinks();
  if (publico === 'EMPRESA') {
    const { bonificacao } = await situacaoDaEmpresa(usuario.id);
    return EmailTemplates.generateCompanyWelcomeEmail({
      nomeEmpresa: usuario.nomeCompleto,
      cnpj: usuario.cnpj ?? null,
      linkCriarSenha,
      validadeHoras,
      platformUrl: links.platformUrl,
      heroImageUrl: links.heroImageUrl,
      videoUrl: links.videoUrl,
      bonificacao: bonificacao
        ? {
            planoNome: bonificacao.planoNome,
            quantidadeVagas: bonificacao.quantidadeVagas,
            validoAte: new Date(bonificacao.validoAte),
          }
        : null,
    });
  }
  return EmailTemplates.generatePlatformWelcomeEmail({
    nomeCompleto: usuario.nomeCompleto,
    ...links,
    maxCurriculos: MAX_CURRICULOS,
    primeiroAcesso: { cpf: usuario.cpf ?? '', linkCriarSenha, validadeHoras },
  });
}

/** Envia o e-mail de boas-vindas com o link de criar senha (token da recuperação) */
export async function enviarBoasVindasComLink(
  usuario: {
    id: string;
    email: string;
    nomeCompleto: string;
    cpf: string | null;
    cnpj?: string | null;
  },
  token: string,
  publico: PublicoPrimeiroAcesso = 'ALUNO',
): Promise<EmailSendResult> {
  const config = await EmailConfigManager.getInstance().getRuntimeConfig();
  const linkCriarSenha = `${config.urls.passwordRecovery}?tp=${token}&ep=${encodeURIComponent(
    usuario.email,
  )}`;
  const template = await montarEmailBoasVindas(
    usuario,
    linkCriarSenha,
    config.passwordRecovery.tokenExpirationMinutes / 60,
    publico,
  );

  const resultado = await EmailDispatcher.getInstance().send({
    to: normalizarEmail(usuario.email),
    toName: usuario.nomeCompleto,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: [publico === 'EMPRESA' ? TAG_EMPRESAS : TAG_COMUNICADO],
  });

  if (resultado.success && !resultado.simulated) {
    await registrarBoasVindasEnviadas(usuario.id, usuario.email, resultado, publico);
  }
  try {
    await prisma.logEmail.create({
      data: {
        usuarioId: usuario.id,
        email: '',
        tipoEmail: 'BOAS_VINDAS',
        status: resultado.success ? 'ENVIADO' : 'FALHA',
        messageId: resultado.messageId ?? '',
        erro: resultado.success ? null : (resultado.error ?? 'Erro desconhecido'),
        tentativas: 1,
      },
    });
  } catch (error) {
    log.warn({ err: error }, '⚠️ Erro ao registrar log do e-mail de boas-vindas');
  }
  return resultado;
}

/** Etiqueta na Brevo para as boas-vindas das empresas */
export const TAG_EMPRESAS = 'boas-vindas-empresas';

/**
 * Registra no comunicado: recebeu as boas-vindas (fica fora do envio em massa, que
 * mandaria outra senha) e a entrega/devolução é acompanhada pela sincronização.
 */
export async function registrarBoasVindasEnviadas(
  usuarioId: string,
  email: string,
  envio: { provider?: string | null; messageId?: string | null },
  publico: PublicoPrimeiroAcesso = 'ALUNO',
): Promise<void> {
  try {
    const { comunicado, quem } = PUBLICOS[publico];
    const chave = { comunicado_usuarioId: { comunicado, usuarioId } };
    const atual = await prisma.comunicadosEnvios.findUnique({
      where: chave,
      select: { status: true },
    });
    if (atual?.status === 'PROCESSANDO' || atual?.status === 'CONCLUIDO_PELO_ALUNO') return;

    const agora = new Date();
    const dados = {
      email: normalizarEmail(email),
      status: 'ENVIADO',
      provider: envio.provider ?? null,
      messageId: envio.messageId ?? null,
      enviadoEm: agora,
      entregueEm: null,
      erro: `Boas-vindas com link de criar senha (pedido ${quem === 'Empresa' ? 'da empresa' : 'do aluno'} em "Esqueci minha senha")`,
    };
    await prisma.comunicadosEnvios.upsert({
      where: chave,
      create: { comunicado, usuarioId, tentativas: 1, ...dados },
      update: { ...dados, tentativas: { increment: 1 } },
    });
  } catch (error) {
    log.error({ err: error, usuarioId }, '⚠️ Não foi possível registrar as boas-vindas enviadas');
  }
}
