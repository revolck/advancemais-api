import { CursosMateriais, CursosMetodos, Prisma, TiposDeArquivos } from '@prisma/client';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';

const aulasLogger = logger.child({ module: 'CursosAulasService' });

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
    where: { id: turmaId, cursoId },
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
  async list(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const aulas = await prisma.cursosTurmasAulas.findMany({
      where: { turmaId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      ...aulaWithMateriaisInclude,
    });

    return (aulas as AulaWithMateriais[]).map(mapAula);
  },

  async get(cursoId: string, turmaId: string, aulaId: string) {
    await ensureAulaBelongsToTurma(prisma, cursoId, turmaId, aulaId);

    return fetchAula(prisma, aulaId);
  },

  async create(cursoId: string, turmaId: string, data: AulaInput & { nome: string }) {
    return prisma.$transaction(async (tx) => {
      const turma = await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const ordem = data.ordem ?? (await tx.cursosTurmasAulas.count({ where: { turmaId } })) + 1;
      const deliveryFields = resolveDeliveryFieldsOnCreate(turma.metodo, data);

      // Gerar código único para a aula
      const ultimaAula = await tx.cursosTurmasAulas.findFirst({
        where: { turmaId },
        orderBy: { criadoEm: 'desc' },
        select: { codigo: true },
      });

      let numero = 1;
      if (ultimaAula?.codigo) {
        const match = ultimaAula.codigo.match(/AUL-(\d+)/);
        if (match) numero = parseInt(match[1], 10) + 1;
      }

      const codigo = `AUL-${numero.toString().padStart(6, '0')}`;

      const aula = await tx.cursosTurmasAulas.create({
        data: {
          codigo,
          turmaId,
          moduloId: data.moduloId ?? null,
          nome: data.nome,
          descricao: data.descricao ?? null,
          ordem,
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

      return fetchAula(tx, aula.id);
    });
  },

  async update(cursoId: string, turmaId: string, aulaId: string, data: AulaInput) {
    return prisma.$transaction(async (tx) => {
      const aulaInfo = await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

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

  async remove(cursoId: string, turmaId: string, aulaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

      await tx.cursosTurmasAulas.delete({ where: { id: aulaId } });

      aulasLogger.info({ turmaId, aulaId }, 'Aula removida com sucesso');

      return { success: true } as const;
    });
  },
};
