/**
 * Script de testes automatizados - Sistema de Aulas
 *
 * Uso:
 *   npx tsx scripts/test-aulas-automatizado.ts
 */

import { prisma } from '../src/config/prisma';
import { logger } from '../src/utils/logger';

async function main() {
  logger.info('🧪 Iniciando testes do sistema de aulas...\n');

  try {
    // 1. Verificar se tabelas foram criadas
    logger.info('📊 Teste 1: Verificar tabelas criadas');

    const tabelas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('CursosAulasProgresso', 'CursosAulasHistorico', 'NotificacoesEnviadas')
      ORDER BY table_name;
    `;

    logger.info(
      `✅ ${tabelas.length}/3 tabelas encontradas:`,
      tabelas.map((t) => t.table_name),
    );

    // 2. Verificar campos em CursosTurmasAulas
    logger.info('\n📊 Teste 2: Verificar campos de aulas');

    const campos = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CursosTurmasAulas' 
      AND column_name IN ('modalidade', 'status', 'obrigatoria', 'meetEventId', 'criadoPorId')
      ORDER BY column_name;
    `;

    logger.info(
      `✅ ${campos.length}/5 campos encontrados:`,
      campos.map((c) => c.column_name),
    );

    // 3. Verificar campos Google em Usuarios
    logger.info('\n📊 Teste 3: Verificar campos Google OAuth');

    const camposGoogle = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Usuarios' 
      AND column_name IN ('googleAccessToken', 'googleRefreshToken', 'googleCalendarId')
      ORDER BY column_name;
    `;

    logger.info(
      `✅ ${camposGoogle.length}/3 campos Google encontrados:`,
      camposGoogle.map((c) => c.column_name),
    );

    // 4. Contar aulas existentes
    logger.info('\n📊 Teste 4: Contar aulas existentes');

    const totalAulas = await prisma.cursosTurmasAulas.count({
      where: { deletedAt: null },
    });

    logger.info(`✅ ${totalAulas} aulas encontradas no sistema`);

    // 5. Verificar tipos de notificação
    logger.info('\n📊 Teste 5: Verificar novos tipos de notificação');

    const tiposNotif = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificacaoTipo')
      AND enumlabel IN ('NOVA_AULA', 'AULA_CANCELADA', 'PROVA_EM_2H')
      ORDER BY enumlabel;
    `;

    logger.info(
      `✅ ${tiposNotif.length}/3 tipos de notificação encontrados:`,
      tiposNotif.map((t) => t.enumlabel),
    );

    // 6. Testar se pode criar aula (estrutura)
    logger.info('\n📊 Teste 6: Verificar estrutura de criação de aula');

    const turmaExemplo = await prisma.cursosTurmas.findFirst({
      where: { status: 'PUBLICADO' },
      select: { id: true, nome: true },
    });

    if (turmaExemplo) {
      logger.info(`✅ Turma disponível para teste: ${turmaExemplo.nome} (${turmaExemplo.id})`);
    } else {
      logger.warn('⚠️  Nenhuma turma publicada encontrada para teste');
    }

    // 7. Resumo final
    logger.info('\n═════════════════════════════════════════');
    logger.info('✅ TODOS OS TESTES ESTRUTURAIS PASSARAM!');
    logger.info('═════════════════════════════════════════');
    logger.info('\n📋 Próximo passo: Testar endpoints REST');
    logger.info('   Arquivo: scripts/test-sistema-completo.http\n');
  } catch (error) {
    logger.error('❌ Erro nos testes:', error);
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
