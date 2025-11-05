/**
 * Service de bloqueios de instrutores
 * Responsabilidade única: gerenciar bloqueios de instrutores
 * Reutiliza lógica de bloqueios de alunos adaptada para INSTRUTOR
 *
 * @author Sistema Advance+
 * @version 1.0.0
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

const bloqueioLogger = logger.child({ module: 'InstrutorBloqueiosService' });

// Select statement para bloqueios (mesmo formato de alunos)
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

export type InstrutorBloqueioResumo = {
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
const mapBloqueioResumo = (bloqueio: BloqueioResumoData | null): InstrutorBloqueioResumo | null => {
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
 * Garante que instrutor existe e é do tipo correto
 */
async function ensureInstrutorExiste(tx: Prisma.TransactionClient, instrutorId: string) {
  const instrutor = await tx.usuarios.findUnique({
    where: { id: instrutorId },
    select: { id: true, nomeCompleto: true, role: true, email: true },
  });

  if (!instrutor) {
    throw Object.assign(new Error('Instrutor não encontrado'), {
      code: 'INSTRUTOR_NOT_FOUND',
    });
  }

  if (instrutor.role !== 'INSTRUTOR') {
    throw Object.assign(new Error('Usuário não é um instrutor'), {
      code: 'INVALID_USER_TYPE',
    });
  }

  return instrutor;
}

/**
 * Aplica bloqueio ao instrutor
 */
export async function aplicarBloqueioInstrutor(
  instrutorId: string,
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
    const instrutor = await ensureInstrutorExiste(tx, instrutorId);

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
      where: { id: instrutorId },
      data: { status: Status.BLOQUEADO },
    });

    // Cria registro de bloqueio
    const novoBloqueio = await tx.usuariosEmBloqueios.create({
      data: {
        usuarioId: instrutor.id,
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
      instrutorId,
      adminId,
      tipo: input.tipo,
      motivo: input.motivo,
      bloqueioId: bloqueio.id,
    },
    '✅ Bloqueio aplicado ao instrutor',
  );

  return mapBloqueioResumo(bloqueio);
}

/**
 * Revoga bloqueio ativo do instrutor
 */
export async function revogarBloqueioInstrutor(
  instrutorId: string,
  adminId: string,
  observacoes?: string | null,
) {
  const instrutor = await ensureInstrutorExiste(prisma, instrutorId);

  const bloqueioAtivo = await prisma.usuariosEmBloqueios.findFirst({
    where: { usuarioId: instrutorId, status: StatusDeBloqueios.ATIVO },
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
    await tx.usuarios.update({ where: { id: instrutorId }, data: { status: Status.ATIVO } });
  });

  bloqueioLogger.info(
    {
      instrutorId,
      adminId,
      bloqueioId: bloqueioAtivo.id,
    },
    '✅ Bloqueio revogado do instrutor',
  );
}

/**
 * Lista bloqueios do instrutor com paginação
 */
export async function listarBloqueiosInstrutor(
  instrutorId: string,
  page: number = 1,
  pageSize: number = 20,
) {
  await ensureInstrutorExiste(prisma, instrutorId);

  const skip = (page - 1) * pageSize;

  const [total, bloqueios] = await prisma.$transaction([
    prisma.usuariosEmBloqueios.count({ where: { usuarioId: instrutorId } }),
    prisma.usuariosEmBloqueios.findMany({
      where: { usuarioId: instrutorId },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
      select: bloqueioSelect,
    }),
  ]);

  return {
    data: bloqueios
      .map(mapBloqueioResumo)
      .filter((item): item is InstrutorBloqueioResumo => Boolean(item)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
