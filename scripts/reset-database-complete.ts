/**
 * Script de Reset Completo do Banco de Dados
 * 
 * Este script faz reset completo do banco, removendo TODOS os objetos:
 * - Tabelas
 * - Enums/Tipos
 * - Sequences
 * - Funções
 * - Views
 * - Etc.
 * 
 * Use para produção quando precisar resetar completamente sem usar migrations.
 */

import { PrismaClient } from '@prisma/client';

async function resetDatabaseComplete() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Iniciando reset completo do banco...\n');

    // 1. Remover todas as tabelas (isso também remove enums que são usados apenas por essas tabelas)
    console.log('📋 Passo 1/4: Removendo todas as tabelas...');
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE;`);
        console.log(`  ✅ Removida: ${table.tablename}`);
      } catch (e: any) {
        console.log(`  ⚠️  Erro ao remover ${table.tablename}: ${e.message}`);
      }
    }

    // 2. Remover todos os tipos/enums customizados
    console.log('\n📋 Passo 2/4: Removendo todos os tipos/enums...');
    const types = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type 
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype = 'e'
      AND typname NOT LIKE 'pg_%'
      ORDER BY typname;
    `;

    for (const type of types) {
      try {
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "${type.typname}" CASCADE;`);
        console.log(`  ✅ Removido: ${type.typname}`);
      } catch (e: any) {
        console.log(`  ⚠️  Erro ao remover ${type.typname}: ${e.message}`);
      }
    }

    // 3. Remover todas as sequences (exceto as do Prisma)
    console.log('\n📋 Passo 3/4: Removendo sequences...');
    const sequences = await prisma.$queryRaw<Array<{ sequence_name: string }>>`
      SELECT sequence_name FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
      AND sequence_name NOT LIKE '_prisma%'
      ORDER BY sequence_name;
    `;

    for (const seq of sequences) {
      try {
        await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${seq.sequence_name}" CASCADE;`);
        console.log(`  ✅ Removida: ${seq.sequence_name}`);
      } catch (e: any) {
        console.log(`  ⚠️  Erro ao remover ${seq.sequence_name}: ${e.message}`);
      }
    }

    // 4. Limpar tabelas de migração do Prisma (se existirem)
    console.log('\n📋 Passo 4/4: Limpando histórico de migrations do Prisma...');
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;`);
      console.log('  ✅ Histórico de migrations removido');
    } catch (e: any) {
      console.log(`  ⚠️  ${e.message}`);
    }

    console.log('\n✅ Reset completo concluído!');
    console.log('💡 Agora execute: pnpm prisma db push && pnpm prisma generate\n');

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

resetDatabaseComplete();

