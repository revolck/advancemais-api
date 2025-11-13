/**
 * Script para testar otimizações de queries
 * Execute: pnpm tsx scripts/test-query-optimizations.ts
 */

import { prisma } from '../src/config/prisma';
import { QueryProfiler } from '../src/modules/usuarios/utils/query-optimizer';
import { getCachedOrFetch, generateCacheKey } from '../src/utils/cache';

async function testQueryOptimizations() {
  console.log('🧪 Testando otimizações de queries...\n');

  try {
    // Teste 1: Listar usuários (com cache)
    console.log('1️⃣ Testando listagem de usuários (com cache)...');
    const cacheKey1 = generateCacheKey('users:list', { page: 1, limit: 10 });
    
    const start1 = Date.now();
    const usuarios = await getCachedOrFetch(
      cacheKey1,
      async () => {
        return await prisma.usuarios.findMany({
          take: 10,
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            role: true,
            status: true,
          },
        });
      },
      30,
    );
    const duration1 = Date.now() - start1;
    console.log(`   ✅ Listagem: ${duration1}ms (${usuarios.length} usuários)`);

    // Teste 2: Listar usuários novamente (deve usar cache)
    console.log('2️⃣ Testando listagem de usuários (cache hit)...');
    const start2 = Date.now();
    const usuarios2 = await getCachedOrFetch(
      cacheKey1,
      async () => {
        return await prisma.usuarios.findMany({
          take: 10,
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            role: true,
            status: true,
          },
        });
      },
      30,
    );
    const duration2 = Date.now() - start2;
    console.log(`   ✅ Listagem (cache): ${duration2}ms (${usuarios2.length} usuários)`);
    console.log(`   📊 Melhoria de performance: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%`);

    // Teste 3: Listar instrutores com filtro
    console.log('3️⃣ Testando listagem de instrutores (com filtro)...');
    const start3 = Date.now();
    const instrutores = await prisma.usuarios.findMany({
      where: {
        role: 'INSTRUTOR',
        status: 'ATIVO',
      },
      take: 10,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
    const duration3 = Date.now() - start3;
    QueryProfiler.record('listarInstrutores', duration3);
    console.log(`   ✅ Listagem de instrutores: ${duration3}ms (${instrutores.length} instrutores)`);

    // Teste 4: Buscar usuários por cidade
    console.log('4️⃣ Testando busca por cidade...');
    const start4 = Date.now();
    const usuariosPorCidade = await prisma.usuarios.findMany({
      where: {
        UsuariosEnderecos: {
          some: {
            cidade: {
              contains: 'São Paulo',
              mode: 'insensitive',
            },
          },
        },
      },
      take: 10,
      select: {
        id: true,
        nomeCompleto: true,
      },
    });
    const duration4 = Date.now() - start4;
    QueryProfiler.record('buscarPorCidade', duration4);
    console.log(`   ✅ Busca por cidade: ${duration4}ms (${usuariosPorCidade.length} usuários)`);

    // Teste 5: Buscar usuários por nome (case-insensitive)
    console.log('5️⃣ Testando busca por nome (case-insensitive)...');
    const start5 = Date.now();
    const usuariosPorNome = await prisma.usuarios.findMany({
      where: {
        nomeCompleto: {
          contains: 'silva',
          mode: 'insensitive',
        },
      },
      take: 10,
      select: {
        id: true,
        nomeCompleto: true,
      },
    });
    const duration5 = Date.now() - start5;
    QueryProfiler.record('buscarPorNome', duration5);
    console.log(`   ✅ Busca por nome: ${duration5}ms (${usuariosPorNome.length} usuários)`);

    // Estatísticas do profiler
    console.log('\n📊 Estatísticas do Profiler:');
    const stats = QueryProfiler.getStats();
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n✅ Todos os testes concluídos com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao testar otimizações:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar testes
testQueryOptimizations().catch(console.error);

