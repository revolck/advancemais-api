/**
 * Script de Reset Manual do Banco de Dados
 * 
 * Este script faz reset manual do banco quando o prisma migrate reset
 * falha devido ao pooler do Supabase não suportar comandos DDL.
 */

import { PrismaClient } from '@prisma/client';

async function resetDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Iniciando reset manual do banco...\n');
    
    // Lista todas as tabelas (exceto as do Prisma)
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;
    
    console.log(`📋 Encontradas ${tables.length} tabelas para limpar\n`);
    
    // Desabilitar triggers e constraints temporariamente
    await prisma.$executeRaw`SET session_replication_role = 'replica';`;
    
    // Truncar todas as tabelas (cascata para limpar dependências)
    let cleaned = 0;
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" CASCADE;`);
        console.log(`  ✅ Limpou: ${table.tablename}`);
        cleaned++;
      } catch (e: any) {
        console.log(`  ⚠️  Erro ao limpar ${table.tablename}: ${e.message}`);
      }
    }
    
    // Reabilitar triggers e constraints
    await prisma.$executeRaw`SET session_replication_role = 'origin';`;
    
    console.log(`\n✅ Reset manual concluído! ${cleaned}/${tables.length} tabelas limpas.`);
    console.log('💡 Execute o seed para popular o banco novamente: pnpm run seed\n');
    
    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

resetDatabase();
