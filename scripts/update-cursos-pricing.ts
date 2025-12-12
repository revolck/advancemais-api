/**
 * Script para atualizar cursos existentes com valores de teste
 */

import { prisma } from '../src/config/prisma';
import { logger } from '../src/utils/logger';

async function main() {
  logger.info('💰 Atualizando cursos com valores de precificação...');

  try {
    // 1. Atualizar curso "Node.js Avançado" (se existir)
    const nodejs = await prisma.cursos.updateMany({
      where: { codigo: 'NODEJS2025' },
      data: {
        valor: 299.9,
        valorPromocional: 249.9,
        gratuito: false,
      },
    });
    if (nodejs.count > 0) {
      logger.info(`✅ Curso "Node.js Avançado" atualizado (${nodejs.count} registro)`);
    }

    // 2. Atualizar curso "Introdução" como gratuito (se existir)
    const intro = await prisma.cursos.updateMany({
      where: { codigo: 'INTRO2025' },
      data: {
        valor: 0,
        valorPromocional: null,
        gratuito: true,
      },
    });
    if (intro.count > 0) {
      logger.info(`✅ Curso "Introdução" atualizado como GRATUITO (${intro.count} registro)`);
    }

    // 3. Atualizar todos os cursos publicados que têm valor = 0
    const updated = await prisma.cursos.updateMany({
      where: {
        valor: 0,
        gratuito: false,
        statusPadrao: 'PUBLICADO',
      },
      data: {
        valor: 199.9,
      },
    });
    logger.info(`✅ ${updated.count} cursos atualizados com valor padrão de R$ 199,90`);

    // 4. Buscar e exibir cursos com preços
    const cursos = await prisma.cursos.findMany({
      where: { statusPadrao: 'PUBLICADO' },
      select: {
        codigo: true,
        nome: true,
        valor: true,
        valorPromocional: true,
        gratuito: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    });

    logger.info('\n📊 Cursos publicados com preços:');
    logger.info('═'.repeat(80));
    cursos.forEach((curso) => {
      const preco = curso.gratuito
        ? '🎁 GRATUITO'
        : curso.valorPromocional
          ? `R$ ${curso.valor} → R$ ${curso.valorPromocional}`
          : `R$ ${curso.valor}`;
      logger.info(`${curso.codigo.padEnd(12)} ${curso.nome.padEnd(40)} ${preco}`);
    });
    logger.info('═'.repeat(80));

    logger.info('\n✅ Atualização concluída!');
  } catch (error) {
    logger.error('❌ Erro ao atualizar cursos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
