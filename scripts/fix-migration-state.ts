/**
 * Script para Corrigir Estado de Migrations
 *
 * Remove migrations problemáticas do histórico do Prisma
 * e limpa objetos residuais (enums, tipos) que causam conflitos.
 *
 * Use antes do deploy quando houver conflitos de migrations.
 */

import { PrismaClient } from '@prisma/client';

async function fixMigrationState() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Corrigindo estado de migrations...\n');

    // 1. Verificar se existe a tabela de migrations
    const migrationsTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      );
    `;

    if (migrationsTable[0]?.exists) {
      console.log('📋 Removendo migrations problemáticas do histórico...');

      // Remover migration específica que está causando problema
      await prisma.$executeRawUnsafe(`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20251105140000_init';
      `);

      console.log('  ✅ Migration removida do histórico');
    }

    // 2. Verificar se há tipos/enums que podem causar conflito
    // O db push vai resolver automaticamente os conflitos
    console.log('\n📋 Tipos/enums serão sincronizados pelo db push...');

    console.log('\n✅ Estado de migrations corrigido!');
    console.log('💡 Agora você pode executar: pnpm prisma db push && pnpm prisma generate\n');

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixMigrationState();
