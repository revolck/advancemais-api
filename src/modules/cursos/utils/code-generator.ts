import type { Prisma } from '@prisma/client';

import type { AppLogger } from '@/utils/logger';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const randomPrefix = (length = 3) => {
  let prefix = '';
  for (let index = 0; index < length; index += 1) {
    prefix += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return prefix;
};

const randomNumber = (digits = 4) => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const withFallback = (prefixLength: number, digits: number) =>
  `${randomPrefix(prefixLength)}${Date.now().toString().slice(-digits)}`;

const attemptUniqueCode = async (
  attempts: number,
  generator: () => string,
  checkUnique: (candidate: string) => Promise<boolean>,
  fallback: () => string,
  logger?: AppLogger,
) => {
  const scopedLogger = logger?.child({ feature: 'CursosCodeGenerator' }) ?? logger;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = generator();
    const isUnique = await checkUnique(candidate);
    if (isUnique) {
      scopedLogger?.debug?.('Generated unique code', { candidate, attempt });
      return candidate;
    }
  }

  const fallbackCode = fallback();
  scopedLogger?.warn?.('Falling back to timestamp based code generation', { fallbackCode });
  return fallbackCode;
};

export const generateUniqueCourseCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `${randomPrefix()}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.cursos.findUnique({
        where: { codigo: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => withFallback(3, 6),
    logger,
  );
};

export const generateUniqueCategoryCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `${randomPrefix()}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.cursosCategorias.findUnique({
        where: { codCategoria: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => withFallback(3, 6),
    logger,
  );
};

export const generateUniqueSubcategoryCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `${randomPrefix()}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.cursosSubcategorias.findUnique({
        where: { codSubcategoria: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => withFallback(3, 6),
    logger,
  );
};

export const generateUniqueTurmaCode = async (tx: Prisma.TransactionClient, logger?: AppLogger) => {
  return attemptUniqueCode(
    10,
    () => `TR${randomPrefix(2)}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.cursosTurmas.findUnique({
        where: { codigo: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => `TR${withFallback(2, 6)}`,
    logger,
  );
};

export const generateUniqueInscricaoCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `INS${randomNumber(5)}`,
    async (candidate) => {
      const existing = await tx.usuariosInformation.findFirst({
        where: { inscricao: candidate },
        select: { usuarioId: true },
      });
      return !existing;
    },
    () => `INS${withFallback(2, 5)}`,
    logger,
  );
};

export const generateUniqueCertificateCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `CERT${randomPrefix(2)}${randomNumber(5)}`,
    async (candidate) => {
      const existing = await tx.cursosCertificadosEmitidos.findUnique({
        where: { codigo: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => `CERT${withFallback(2, 6)}`,
    logger,
  );
};
