import {
  CursoStatus,
  CursosMateriais,
  CursosMetodos,
  Prisma,
  Roles,
  StatusInscricao,
  TiposDeArquivos,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { notificacoesHelper } from '../aulas/services/notificacoes-helper.service';
import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';

const aulasLogger = logger.child({ module: 'CursosAulasService' });

const turmaJaFoiIniciada = (turma: { status?: CursoStatus | null; dataInicio?: Date | null }) => {
  if (turma.status === CursoStatus.EM_ANDAMENTO || turma.status === CursoStatus.CONCLUIDO) {
    return true;
  }

  return Boolean(turma.dataInicio && turma.dataInicio <= new Date());
};

const hasActiveInscricoes = async (client: PrismaClientOrTx, turmaId: string) => {
  const count = await client.cursosTurmasInscricoes.count({
    where: {
      turmaId,
      status: {
        notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO],
      },
    },
  });

  return count > 0;
};

const ensureInstrutorPodeAcessarTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  usuarioId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: {
      id: turmaId,
      cursoId,
      OR: [
        { CursosTurmasAulas: { some: { instrutorId: usuarioId } } },
        { CursosTurmasProvas: { some: { instrutorId: usuarioId, ativo: true } } },
      ],
    },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Instrutor só pode acessar conteúdos vinculados às próprias turmas');
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
};

const ensureInstrutorPodeAcessarAula = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  aulaId: string,
  usuarioId: string,
) => {
  const aula = await client.cursosTurmasAulas.findFirst({
    where: {
      id: aulaId,
      turmaId,
      CursosTurmas: { cursoId },
    },
    select: {
      id: true,
      instrutorId: true,
      CursosTurmas: { select: { instrutorId: true } },
    },
  });

  if (!aula) {
    const error = new Error('Aula não encontrada para a turma informada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }

  const vinculado = aula.instrutorId
    ? aula.instrutorId === usuarioId
    : aula.CursosTurmas?.instrutorId === usuarioId;

  if (!vinculado) {
    const error = new Error('Instrutor só pode acessar aulas vinculadas a ele');
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
};

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type AulaMaterialInput = {
  titulo: string;
  descricao?: string | null;
  tipo: CursosMateriais;
  tipoArquivo?: TiposDeArquivos | null;
  url?: string | null;
  duracaoEmSegundos?: number | null;
  tamanhoEmBytes?: number | null;
  ordem?: number | null;
};

type AulaInput = {
  moduloId?: string | null;
  nome?: string;
  descricao?: string | null;
  ordem?: number | null;
  materiais?: AulaMaterialInput[];
  urlVideo?: string | null;
  sala?: string | null;
  urlMeet?: string | null;
};

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
): Promise<{ id: string; metodo: CursosMetodos }> => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId, deletedAt: null },
    select: { id: true, metodo: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }

  return turma;
};

const ensureAulaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  aulaId: string,
): Promise<{ id: string; metodo: CursosMetodos }> => {
  const aula = await client.cursosTurmasAulas.findFirst({
    where: {
      id: aulaId,
      turmaId,
      CursosTurmas: { cursoId },
    },
    select: {
      id: true,
      CursosTurmas: {
        select: { metodo: true },
      },
    },
  });

  if (!aula || !aula.CursosTurmas) {
    const error = new Error('Aula não encontrada para a turma informada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }

  return { id: aula.id, metodo: aula.CursosTurmas.metodo };
};

const ensureModuloBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  moduloId: string,
): Promise<void> => {
  const modulo = await client.cursosTurmasModulos.findFirst({
    where: { id: moduloId, turmaId },
    select: { id: true },
  });

  if (!modulo) {
    const error = new Error('Módulo não encontrado para a turma informada');
    (error as any).code = 'MODULO_NOT_FOUND';
    throw error;
  }
};

const fetchAula = async (
  client: PrismaClientOrTx,
  aulaId: string,
): Promise<ReturnType<typeof mapAula>> => {
  const aula = await client.cursosTurmasAulas.findUnique({
    where: { id: aulaId },
    ...aulaWithMateriaisInclude,
  });

  if (!aula) {
    const error = new Error('Aula não encontrada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }

  return mapAula(aula as AulaWithMateriais);
};

const normalizeMaterialInput = (material: AulaMaterialInput) => ({
  titulo: material.titulo,
  descricao: material.descricao ?? null,
  tipo: material.tipo,
  tipoArquivo: material.tipoArquivo ?? null,
  url: material.url ?? null,
  duracaoEmSegundos: material.duracaoEmSegundos ?? null,
  tamanhoEmBytes: material.tamanhoEmBytes ?? null,
  ordem: material.ordem ?? 0,
});

const sanitizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const generateMeetUrl = () => {
  const raw = randomUUID().replace(/-/g, '').slice(0, 12);
  const segments = raw.match(/.{1,4}/g) ?? ['adv', 'meet', 'link'];
  return `https://meet.google.com/${segments.join('-')}`;
};

const generateUniqueAulaCodigo = async (client: PrismaClientOrTx) => {
  const ultimaAula = await client.cursosTurmasAulas.findFirst({
    where: { codigo: { startsWith: 'AUL-' } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  let numero = 1;
  if (ultimaAula?.codigo) {
    const match = ultimaAula.codigo.match(/AUL-(\d+)/);
    if (match) {
      numero = parseInt(match[1], 10) + 1;
    }
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `AUL-${(numero + attempt).toString().padStart(6, '0')}`;
    const existing = await client.cursosTurmasAulas.findFirst({
      where: { codigo: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `AUL-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
};

const resolveDeliveryFieldsOnCreate = (
  metodo: CursosMetodos,
  data: AulaInput & { nome: string },
): { urlVideo: string | null; sala: string | null; urlMeet: string | null } => {
  const videoUrl = sanitizeOptionalString(data.urlVideo ?? undefined) ?? null;
  const sala = sanitizeOptionalString(data.sala ?? undefined) ?? null;
  const meetUrl = sanitizeOptionalString(data.urlMeet ?? undefined) ?? null;

  switch (metodo) {
    case CursosMetodos.ONLINE: {
      if (!videoUrl) {
        const error = new Error('URL do vídeo é obrigatória para turmas online');
        (error as any).code = 'INVALID_DELIVERY_FIELDS';
        throw error;
      }

      return { urlVideo: videoUrl, sala: null, urlMeet: null };
    }
    case CursosMetodos.PRESENCIAL: {
      if (!sala) {
        const error = new Error('Sala é obrigatória para turmas presenciais');
        (error as any).code = 'INVALID_DELIVERY_FIELDS';
        throw error;
      }

      return { urlVideo: null, sala, urlMeet: null };
    }
    case CursosMetodos.LIVE: {
      return { urlVideo: null, sala: null, urlMeet: meetUrl ?? generateMeetUrl() };
    }
    case CursosMetodos.SEMIPRESENCIAL:
    default:
      return { urlVideo: videoUrl, sala, urlMeet: meetUrl };
  }
};

const resolveDeliveryFieldsOnUpdate = (
  metodo: CursosMetodos,
  data: AulaInput,
): { urlVideo?: string | null; sala?: string | null; urlMeet?: string | null } => {
  const videoUrl = sanitizeOptionalString(data.urlVideo);
  const sala = sanitizeOptionalString(data.sala);
  const meetUrl = sanitizeOptionalString(data.urlMeet);

  switch (metodo) {
    case CursosMetodos.ONLINE: {
      if (data.urlVideo !== undefined) {
        if (!videoUrl) {
          const error = new Error('URL do vídeo é obrigatória para turmas online');
          (error as any).code = 'INVALID_DELIVERY_FIELDS';
          throw error;
        }

        return { urlVideo: videoUrl, sala: null, urlMeet: null };
      }

      return {};
    }
    case CursosMetodos.PRESENCIAL: {
      if (data.sala !== undefined) {
        if (!sala) {
          const error = new Error('Sala é obrigatória para turmas presenciais');
          (error as any).code = 'INVALID_DELIVERY_FIELDS';
          throw error;
        }

        return { sala, urlVideo: null, urlMeet: null };
      }

      return {};
    }
    case CursosMetodos.LIVE: {
      if (data.urlMeet !== undefined) {
        return { urlMeet: meetUrl ?? generateMeetUrl(), urlVideo: null, sala: null };
      }

      return {};
    }
    case CursosMetodos.SEMIPRESENCIAL:
    default: {
      const update: { urlVideo?: string | null; sala?: string | null; urlMeet?: string | null } =
        {};

      if (data.urlVideo !== undefined) {
        update.urlVideo = videoUrl ?? null;
      }

      if (data.sala !== undefined) {
        update.sala = sala ?? null;
      }

      if (data.urlMeet !== undefined) {
        update.urlMeet = meetUrl ?? null;
      }

      return update;
    }
  }
};

export const aulasService = {
  async list(
    cursoId: string,
    turmaId: string,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    if (actor?.role === Roles.INSTRUTOR && actor.id) {
      await ensureInstrutorPodeAcessarTurma(prisma, cursoId, turmaId, actor.id);
    }

    const aulas = await prisma.cursosTurmasAulas.findMany({
      where: {
        turmaId,
        ...(actor?.role === Roles.INSTRUTOR && actor.id ? { instrutorId: actor.id } : {}),
      },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      ...aulaWithMateriaisInclude,
    });

    return (aulas as AulaWithMateriais[]).map(mapAula);
  },

  async get(
    cursoId: string,
    turmaId: string,
    aulaId: string,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    await ensureAulaBelongsToTurma(prisma, cursoId, turmaId, aulaId);

    if (actor?.role === Roles.INSTRUTOR && actor.id) {
      await ensureInstrutorPodeAcessarAula(prisma, cursoId, turmaId, aulaId, actor.id);
    }

    return fetchAula(prisma, aulaId);
  },

  async create(
    cursoId: string,
    turmaId: string,
    data: AulaInput & { nome: string },
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    const { aula, notificarAlunos } = await prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findFirst({
        where: { id: turmaId, cursoId, deletedAt: null },
        select: {
          id: true,
          metodo: true,
          status: true,
          dataInicio: true,
          instrutorId: true,
          CursosTurmasInstrutores: {
            where: actor?.id ? { instrutorId: actor.id } : undefined,
            select: { instrutorId: true },
          },
        },
      });

      if (!turma) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const turmaIniciada = turmaJaFoiIniciada(turma);
      const actorLinked = Boolean(
        actor?.id &&
          (turma.instrutorId === actor.id || (turma.CursosTurmasInstrutores?.length ?? 0) > 0),
      );

      if (actor?.role === Roles.INSTRUTOR && !actorLinked) {
        const error = new Error('Instrutor só pode criar aulas em turmas vinculadas a ele');
        (error as any).code = 'FORBIDDEN';
        throw error;
      }

      if (actor?.role === Roles.INSTRUTOR && turmaIniciada) {
        const error = new Error('Instrutor não pode criar aula em turma já iniciada');
        (error as any).code = 'INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA';
        throw error;
      }

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const ordem = data.ordem ?? (await tx.cursosTurmasAulas.count({ where: { turmaId } })) + 1;
      const deliveryFields = resolveDeliveryFieldsOnCreate(turma.metodo, data);

      const codigo = await generateUniqueAulaCodigo(tx);

      const aula = await tx.cursosTurmasAulas.create({
        data: {
          codigo,
          turmaId,
          moduloId: data.moduloId ?? null,
          nome: data.nome,
          descricao: data.descricao ?? null,
          ordem,
          instrutorId: actor?.role === Roles.INSTRUTOR ? (actor.id ?? null) : undefined,
          ...deliveryFields,
        },
      });

      if (Array.isArray(data.materiais) && data.materiais.length > 0) {
        await tx.cursosTurmasAulasMateriais.createMany({
          data: data.materiais.map((material) => ({
            aulaId: aula.id,
            ...normalizeMaterialInput(material),
          })),
        });
      }

      aulasLogger.info({ turmaId, aulaId: aula.id }, 'Aula criada com sucesso');

      return {
        aula: await fetchAula(tx, aula.id),
        notificarAlunos:
          actor?.role === Roles.PEDAGOGICO &&
          turmaIniciada &&
          (await hasActiveInscricoes(tx, turmaId))
            ? { aulaId: aula.id, nome: aula.nome }
            : null,
      };
    });

    if (notificarAlunos) {
      try {
        await notificacoesHelper.notificarAlunosDaTurma(turmaId, {
          tipo: 'NOVA_AULA',
          titulo: `Nova aula: ${notificarAlunos.nome}`,
          mensagem: 'Foi adicionada uma nova aula à turma em andamento.',
          prioridade: 'NORMAL',
          linkAcao: `/turmas/${turmaId}`,
          eventoId: notificarAlunos.aulaId,
        });
      } catch (error) {
        aulasLogger.warn(
          { err: error, turmaId, aulaId: notificarAlunos.aulaId },
          'Falha ao notificar alunos após criação pedagógica da aula',
        );
      }
    }

    return aula;
  },

  async update(
    cursoId: string,
    turmaId: string,
    aulaId: string,
    data: AulaInput,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const aulaInfo = await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

      if (actor?.role === Roles.INSTRUTOR && actor.id) {
        await ensureInstrutorPodeAcessarAula(tx, cursoId, turmaId, aulaId, actor.id);
      }

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const deliveryFields = resolveDeliveryFieldsOnUpdate(aulaInfo.metodo, data);

      await tx.cursosTurmasAulas.update({
        where: { id: aulaId },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
          ordem: data.ordem ?? undefined,
          moduloId: data.moduloId ?? (data.moduloId === null ? null : undefined),
          ...deliveryFields,
        },
      });

      if (Array.isArray(data.materiais)) {
        await tx.cursosTurmasAulasMateriais.deleteMany({ where: { aulaId } });

        if (data.materiais.length > 0) {
          await tx.cursosTurmasAulasMateriais.createMany({
            data: data.materiais.map((material) => ({
              aulaId,
              ...normalizeMaterialInput(material),
            })),
          });
        }
      }

      aulasLogger.info({ turmaId, aulaId }, 'Aula atualizada com sucesso');

      return fetchAula(tx, aulaId);
    });
  },

  async remove(
    cursoId: string,
    turmaId: string,
    aulaId: string,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

      if (actor?.role === Roles.INSTRUTOR && actor.id) {
        await ensureInstrutorPodeAcessarAula(tx, cursoId, turmaId, aulaId, actor.id);
      }

      await tx.cursosTurmasAulas.delete({ where: { id: aulaId } });

      aulasLogger.info({ turmaId, aulaId }, 'Aula removida com sucesso');

      return { success: true } as const;
    });
  },
};
