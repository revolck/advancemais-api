import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function testPrismaConnection() {
  console.log('🔍 TESTE DE CONEXÃO COM PRISMA\n');
  console.log('='.repeat(50));

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL não encontrada no .env');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL encontrada');
  console.log('📍 Host:', dbUrl.match(/@([^:]+):/)?.[1] || 'N/A');
  console.log('');

  // Criar cliente Prisma com configurações simplificadas
  const prisma = new PrismaClient({
    datasourceUrl: dbUrl,
    log: ['error', 'warn'],
  });

  try {
    console.log('🔄 Tentando conectar com Prisma...');
    const startTime = Date.now();

    await prisma.$connect();

    const elapsed = Date.now() - startTime;
    console.log(`✅ CONECTADO COM SUCESSO! (${elapsed}ms)`);
    console.log('');

    // Testar query simples
    console.log('🧪 Testando query simples ($queryRaw)...');
    const result = await prisma.$queryRaw`SELECT NOW() as now, current_database() as db`;
    console.log('✅ Query executada!');
    console.log('📊 Resultado:', result);
    console.log('');

    // Testar query na tabela de usuários
    console.log('🧪 Testando count na tabela Usuarios...');
    const count = await prisma.usuarios.count();
    console.log(`✅ Total de usuários: ${count}`);

    console.log('');
    console.log('='.repeat(50));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(50));
    console.error('❌ ERRO NA CONEXÃO:');
    console.error('='.repeat(50));
    console.error('');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    console.error('');

    if (error.code === 'P1001') {
      console.error('🔍 Diagnóstico: Prisma não consegue alcançar o servidor');
      console.error('   Possíveis causas:');
      console.error('   - Supabase Pooler temporariamente indisponível');
      console.error('   - Firewall bloqueando conexão');
      console.error('   - Credenciais incorretas');
    } else if (error.code === 'P2024') {
      console.error('🔍 Diagnóstico: Timeout ao buscar conexão do pool');
      console.error('   Aumente pool_timeout na DATABASE_URL');
    }

    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaConnection();
