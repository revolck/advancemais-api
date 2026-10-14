import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { MAX_CURRICULOS } from '@/modules/candidatos/curriculos/services';
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

/**
 * O aluno abriu o link e definiu a própria senha: o e-mail funciona e ele já tem
 * acesso. Tira o aluno da fila do comunicado (que trocaria a senha dele por uma
 * provisória) e registra o endereço como válido. Nunca derruba a redefinição.
 */
export async function registrarAcessoPeloAluno(usuarioId: string): Promise<void> {
  try {
    const usuario = await prisma.usuarios.findFirst({
      where: { id: usuarioId, ...filtroPopulacao() },
      select: { email: true },
    });
    if (!usuario) return;
    const email = normalizarEmail(usuario.email);
    const agora = new Date();

    const atual = await prisma.comunicadosEnvios.findUnique({
      where: { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } },
      select: { status: true },
    });
    if (atual?.status !== 'PROCESSANDO') {
      const dados = {
        email,
        status: 'CONCLUIDO_PELO_ALUNO',
        erro: 'Aluno definiu a própria senha pela recuperação de senha (CPF)',
      };
      await prisma.comunicadosEnvios.upsert({
        where: { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } },
        create: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId, tentativas: 0, ...dados },
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
    log.error(
      { err: error, usuarioId },
      '⚠️ Não foi possível registrar o primeiro acesso pelo aluno',
    );
  }
}

// ---------------------------------------------------------------------------
// Boas-vindas no primeiro pedido de recuperação do aluno migrado
// ---------------------------------------------------------------------------

/**
 * Aluno importado que ainda não fez o primeiro acesso: recebe o e-mail de boas-vindas
 * (com o link de criar senha) em vez do e-mail padrão de recuperação. Depois que ele
 * cria a senha (CONCLUIDO_PELO_ALUNO) ou entra na plataforma, volta a receber o padrão.
 * Quem se cadastrou sozinho nunca entra aqui.
 */
export async function deveEnviarBoasVindas(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.usuarios.findFirst({
    where: { id: usuarioId, ...filtroPopulacao(), ultimoLogin: null },
    select: {
      ComunicadosEnvios: {
        where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO },
        select: { status: true },
      },
    },
  });
  if (!usuario) return false;
  return usuario.ComunicadosEnvios[0]?.status !== 'CONCLUIDO_PELO_ALUNO';
}

/** Envia o e-mail de boas-vindas com o link de criar senha (token da recuperação) */
export async function enviarBoasVindasComLink(
  usuario: { id: string; email: string; nomeCompleto: string; cpf: string | null },
  token: string,
): Promise<EmailSendResult> {
  const config = await EmailConfigManager.getInstance().getRuntimeConfig();
  const linkCriarSenha = `${config.urls.passwordRecovery}?tp=${token}&ep=${encodeURIComponent(
    usuario.email,
  )}`;
  const template = EmailTemplates.generatePlatformWelcomeEmail({
    nomeCompleto: usuario.nomeCompleto,
    ...(await montarLinks()),
    maxCurriculos: MAX_CURRICULOS,
    primeiroAcesso: {
      cpf: usuario.cpf ?? '',
      linkCriarSenha,
      validadeHoras: config.passwordRecovery.tokenExpirationMinutes / 60,
    },
  });

  const resultado = await EmailDispatcher.getInstance().send({
    to: normalizarEmail(usuario.email),
    toName: usuario.nomeCompleto,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: [TAG_COMUNICADO],
  });

  if (resultado.success && !resultado.simulated) {
    await registrarBoasVindasEnviadas(usuario.id, usuario.email, resultado);
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

/**
 * Registra no comunicado: o aluno recebeu as boas-vindas (fica fora do envio em massa,
 * que mandaria outra senha) e a entrega/devolução é acompanhada pela sincronização.
 */
export async function registrarBoasVindasEnviadas(
  usuarioId: string,
  email: string,
  envio: { provider?: string | null; messageId?: string | null },
): Promise<void> {
  try {
    const chave = { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } };
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
      erro: 'Boas-vindas com link de criar senha (pedido do aluno em "Esqueci minha senha")',
    };
    await prisma.comunicadosEnvios.upsert({
      where: chave,
      create: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId, tentativas: 1, ...dados },
      update: { ...dados, tentativas: { increment: 1 } },
    });
  } catch (error) {
    log.error({ err: error, usuarioId }, '⚠️ Não foi possível registrar as boas-vindas enviadas');
  }
}
