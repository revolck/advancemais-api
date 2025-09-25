import { prisma } from '@/config/prisma';
import { CandidatoLogTipo, Prisma } from '@prisma/client';

export type CandidatoLogEntry = {
  usuarioId: string;
  tipo: CandidatoLogTipo;
  descricao?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

const normalizeMetadata = (metadata?: Prisma.InputJsonValue | null) => {
  if (metadata === undefined) {
    return Prisma.JsonNull;
  }

  if (metadata === null) {
    return Prisma.JsonNull;
  }

  return metadata;
};

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const mapEntryToData = (entry: CandidatoLogEntry) => ({
  usuarioId: entry.usuarioId,
  tipo: entry.tipo,
  descricao: entry.descricao ?? null,
  metadata: normalizeMetadata(entry.metadata),
});

const getClient = (tx?: PrismaClientOrTx) => tx ?? prisma;

export const candidatoLogsService = {
  async create(entry: CandidatoLogEntry, tx?: PrismaClientOrTx) {
    const client = getClient(tx);

    return client.usuariosCandidatosLogs.create({
      data: mapEntryToData(entry),
    });
  },

  async bulkCreate(entries: CandidatoLogEntry[], tx?: PrismaClientOrTx) {
    if (entries.length === 0) {
      return [];
    }

    const client = getClient(tx);

    return Promise.all(
      entries.map((entry) => client.usuariosCandidatosLogs.create({ data: mapEntryToData(entry) })),
    );
  },
};
