/**
 * Service de bloqueios de alunos
 * Responsabilidade única: gerenciar bloqueios de alunos
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import {
  Prisma,
  TiposDeBloqueios,
  MotivosDeBloqueios,
  Status,
  StatusDeBloqueios,
  AcoesDeLogDeBloqueio,
} from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { AdminAlunoBloqueioInput } from '../validators/auth.schema';
import { EmailService } from '@/modules/brevo/services/email-service';
import { EmailTemplates } from '@/modules/brevo/templates/email-templates';

const bloqueioLogger = logger.child({ module: 'AlunoBloqueiosService' });

// Select statement para bloqueios
const bloqueioSelect = {
  id: true,
  tipo: true,
  motivo: true,
  status: true,
  inicio: true,
  fim: true,
  observacoes: true,
  criadoEm: true,
  atualizadoEm: true,
  Usuarios_UsuariosEmBloqueios_aplicadoPorIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      role: true,
    },
  },
  Usuarios_UsuariosEmBloqueios_usuarioIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      role: true,
    },
  },
} satisfies Prisma.UsuariosEmBloqueiosSelect;

type BloqueioResumoData = Prisma.UsuariosEmBloqueiosGetPayload<{ select: typeof bloqueioSelect }>;

export type AlunoBloqueioResumo = {
  id: string;
  alvo: {
    id: string;
    nome: string;
    role: string;
  };
  bloqueio: {
    tipo: TiposDeBloqueios;
    motivo: MotivosDeBloqueios;
    status: StatusDeBloqueios;
    inicio: Date;
    fim: Date | null;
    observacoes: string | null;
  };
  aplicadoPor: {
    id: string;
    nome: string;
    role: string;
  } | null;
  auditoria: {
    criadoEm: Date;
    atualizadoEm: Date;
  };
};

/**
 * Mapeia bloqueio para formato de resposta
 */
const mapBloqueioResumo = (bloqueio: BloqueioResumoData | null): AlunoBloqueioResumo | null => {
  if (!bloqueio || !bloqueio.Usuarios_UsuariosEmBloqueios_usuarioIdToUsuarios) {
    return null;
  }

  const aplicadoPor = bloqueio.Usuarios_UsuariosEmBloqueios_aplicadoPorIdToUsuarios
    ? {
        id: bloqueio.Usuarios_UsuariosEmBloqueios_aplicadoPorIdToUsuarios.id,
        nome: bloqueio.Usuarios_UsuariosEmBloqueios_aplicadoPorIdToUsuarios.nomeCompleto,
        role: bloqueio.Usuarios_UsuariosEmBloqueios_aplicadoPorIdToUsuarios.role,
      }
    : null;

  return {
    id: bloqueio.id,
    alvo: {
      id: bloqueio.Usuarios_UsuariosEmBloqueios_usuarioIdToUsuarios.id,
      nome: bloqueio.Usuarios_UsuariosEmBloqueios_usuarioIdToUsuarios.nomeCompleto,
      role: bloqueio.Usuarios_UsuariosEmBloqueios_usuarioIdToUsuarios.role,
    },
    bloqueio: {
      tipo: bloqueio.tipo,
      motivo: bloqueio.motivo,
      status: bloqueio.status,
      inicio: bloqueio.inicio,
      fim: bloqueio.fim ?? null,
      observacoes: bloqueio.observacoes ?? null,
    },
    aplicadoPor,
    auditoria: {
      criadoEm: bloqueio.criadoEm,
      atualizadoEm: bloqueio.atualizadoEm,
    },
  };
};

/**
 * Garante que aluno existe e é do tipo correto
 */
async function ensureAlunoExiste(tx: Prisma.TransactionClient, alunoId: string) {
  const aluno = await tx.usuarios.findUnique({
    where: { id: alunoId },
    select: { id: true, nomeCompleto: true, role: true, email: true },
  });

  if (!aluno) {
    throw Object.assign(new Error('Aluno não encontrado'), {
      code: 'ALUNO_NOT_FOUND',
    });
  }

  if (aluno.role !== 'ALUNO_CANDIDATO') {
    throw Object.assign(new Error('Usuário não é um aluno'), {
      code: 'INVALID_USER_TYPE',
    });
  }

  return aluno;
}

/**
 * Aplica bloqueio ao aluno
 */
export async function aplicarBloqueioAluno(
  alunoId: string,
  adminId: string,
  input: AdminAlunoBloqueioInput,
) {
  const observacoes = input.observacoes?.trim() || undefined;
  const inicio = new Date();
  let fim: Date | null = null;

  if (input.tipo !== TiposDeBloqueios.PERMANENTE && input.dias && input.dias > 0) {
    fim = new Date(inicio.getTime());
    fim.setDate(fim.getDate() + input.dias);
  }

  const bloqueio = await prisma.$transaction(async (tx) => {
    const aluno = await ensureAlunoExiste(tx, alunoId);

    const admin = await tx.usuarios.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    });

    if (!admin || !['ADMIN', 'MODERADOR'].includes(admin.role)) {
      throw Object.assign(new Error('Usuário não autorizado a aplicar bloqueio'), {
        code: 'ADMIN_REQUIRED',
      });
    }

    // Atualiza status do usuário para BLOQUEADO
    await tx.usuarios.update({
      where: { id: alunoId },
      data: { status: Status.BLOQUEADO },
    });

    // Cria registro de bloqueio
    const novoBloqueio = await tx.usuariosEmBloqueios.create({
      data: {
        usuarioId: aluno.id,
        aplicadoPorId: adminId,
        tipo: input.tipo,
        motivo: input.motivo,
        status: StatusDeBloqueios.ATIVO,
        inicio,
        fim,
        ...(observacoes !== undefined ? { observacoes } : {}),
        UsuariosEmBloqueiosLogs: {
          create: {
            acao: AcoesDeLogDeBloqueio.CRIACAO,
            criadoPorId: adminId,
            ...(observacoes !== undefined
              ? { descricao: observacoes }
              : { descricao: 'Bloqueio registrado pelo painel administrativo.' }),
          },
        },
      },
      select: bloqueioSelect,
    });

    return novoBloqueio;
  });

  bloqueioLogger.info(
    {
      alunoId,
      adminId,
      tipo: input.tipo,
      motivo: input.motivo,
      bloqueioId: bloqueio.id,
    },
    '✅ Bloqueio aplicado ao aluno',
  );

  // Envia email de notificação de bloqueio
  try {
    const aluno = await prisma.usuarios.findUnique({
      where: { id: alunoId },
      select: { email: true, nomeCompleto: true },
    });
    if (aluno?.email) {
      const emailService = new EmailService();
      const template = EmailTemplates.generateUserBlockedEmail({
        nomeCompleto: aluno.nomeCompleto,
        motivo: input.motivo,
        fim: input.tipo === TiposDeBloqueios.TEMPORARIO ? fim : null,
        descricao: input.observacoes ?? null,
        tipo: input.tipo,
      });
      await emailService.sendAssinaturaNotificacao(
        { id: alunoId, email: aluno.email, nomeCompleto: aluno.nomeCompleto },
        template,
      );
      bloqueioLogger.info({ alunoId, email: aluno.email }, '📧 Email de bloqueio enviado');
    }
  } catch (error) {
    bloqueioLogger.warn({ err: error, alunoId }, '⚠️ Erro ao enviar email de bloqueio');
    // Não falha o bloqueio se o email falhar
  }

  return mapBloqueioResumo(bloqueio);
}

/**
 * Revoga bloqueio ativo do aluno
 */
export async function revogarBloqueioAluno(
  alunoId: string,
  adminId: string,
  observacoes?: string | null,
) {
  const aluno = await ensureAlunoExiste(prisma, alunoId);

  const bloqueioAtivo = await prisma.usuariosEmBloqueios.findFirst({
    where: { usuarioId: alunoId, status: StatusDeBloqueios.ATIVO },
    orderBy: { criadoEm: 'desc' },
  });

  if (!bloqueioAtivo) {
    throw Object.assign(new Error('Nenhum bloqueio ativo encontrado'), {
      code: 'BLOQUEIO_NOT_FOUND',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuariosEmBloqueios.update({
      where: { id: bloqueioAtivo.id },
      data: {
        status: StatusDeBloqueios.REVOGADO,
        UsuariosEmBloqueiosLogs: {
          create: {
            acao: AcoesDeLogDeBloqueio.REVOGACAO,
            criadoPorId: adminId,
            descricao: observacoes ?? 'Bloqueio revogado pelo painel administrativo.',
          },
        },
      },
    });

    // Atualiza status do usuário para ATIVO
    await tx.usuarios.update({ where: { id: alunoId }, data: { status: Status.ATIVO } });
  });

  bloqueioLogger.info(
    {
      alunoId,
      adminId,
      bloqueioId: bloqueioAtivo.id,
    },
    '✅ Bloqueio revogado do aluno',
  );

  // Envia email de notificação de desbloqueio
  try {
    const aluno = await prisma.usuarios.findUnique({
      where: { id: alunoId },
      select: { email: true, nomeCompleto: true },
    });
    if (aluno?.email) {
      const emailService = new EmailService();
      const template = EmailTemplates.generateUserUnblockedEmail({
        nomeCompleto: aluno.nomeCompleto,
      });
      await emailService.sendAssinaturaNotificacao(
        { id: alunoId, email: aluno.email, nomeCompleto: aluno.nomeCompleto },
        template,
      );
      bloqueioLogger.info({ alunoId, email: aluno.email }, '📧 Email de desbloqueio enviado');
    }
  } catch (error) {
    bloqueioLogger.warn({ err: error, alunoId }, '⚠️ Erro ao enviar email de desbloqueio');
    // Não falha a revogação se o email falhar
  }
}

/**
 * Lista bloqueios do aluno com paginação
 */
export async function listarBloqueiosAluno(
  alunoId: string,
  page: number = 1,
  pageSize: number = 20,
) {
  await ensureAlunoExiste(prisma, alunoId);

  const skip = (page - 1) * pageSize;

  const [total, bloqueios] = await prisma.$transaction([
    prisma.usuariosEmBloqueios.count({ where: { usuarioId: alunoId } }),
    prisma.usuariosEmBloqueios.findMany({
      where: { usuarioId: alunoId },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
      select: bloqueioSelect,
    }),
  ]);

  return {
    data: bloqueios
      .map(mapBloqueioResumo)
      .filter((item): item is AlunoBloqueioResumo => Boolean(item)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
