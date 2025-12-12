import { prisma } from '@/config/prisma';

/**
 * Gerar código único para aula (ex: AUL-000001)
 */
export async function generateCodigoAula(): Promise<string> {
  const ultimaAula = await prisma.cursosTurmasAulas.findFirst({
    where: { codigo: { startsWith: 'AUL-' } },
    orderBy: { criadoEm: 'desc' },
    select: { codigo: true },
  });

  let numero = 1;
  if (ultimaAula?.codigo) {
    const match = ultimaAula.codigo.match(/AUL-(\d+)/);
    if (match) numero = parseInt(match[1], 10) + 1;
  }

  return `AUL-${numero.toString().padStart(6, '0')}`;
}
