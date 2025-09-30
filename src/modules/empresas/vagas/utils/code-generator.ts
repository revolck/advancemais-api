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
  const scopedLogger = logger?.child({ feature: 'EmpresasVagasCodeGenerator' }) ?? logger;

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

export const generateUniqueVagaCategoryCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `${randomPrefix()}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.empresasVagasCategorias.findUnique({
        where: { codCategoria: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => withFallback(3, 6),
    logger,
  );
};

export const generateUniqueVagaSubcategoryCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
) => {
  return attemptUniqueCode(
    10,
    () => `${randomPrefix()}${randomNumber()}`,
    async (candidate) => {
      const existing = await tx.empresasVagasSubcategorias.findUnique({
        where: { codSubcategoria: candidate },
        select: { id: true },
      });
      return !existing;
    },
    () => withFallback(3, 6),
    logger,
  );
};
