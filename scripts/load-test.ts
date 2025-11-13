/**
 * Teste de Carga - Simula 10 requisições simultâneas
 * Execute: pnpm tsx scripts/load-test.ts
 */

import { prisma } from '../src/config/prisma';
import { QueryProfiler } from '../src/modules/usuarios/utils/query-optimizer';
import { getCachedOrFetch, generateCacheKey, getCache } from '../src/utils/cache';
import { getOptimizedUserSelect, optimizeSearchFilter, optimizeAddressFilter } from '../src/modules/usuarios/utils/query-optimizer';

interface TestResult {
  testName: string;
  totalRequests: number;
  concurrentRequests: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  successCount: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
  errors: string[];
}

class LoadTester {
  private results: TestResult[] = [];
  private cacheStats = { hits: 0, misses: 0 };

  async runConcurrentRequests<T>(
    testName: string,
    concurrentCount: number,
    requestFn: (index: number) => Promise<T>,
  ): Promise<TestResult> {
    console.log(`\n🧪 Testando: ${testName}`);
    console.log(`   Requisições simultâneas: ${concurrentCount}`);

    const startTime = Date.now();
    const times: number[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Executar requisições simultâneas
    const promises = Array.from({ length: concurrentCount }, async (_, index) => {
      const requestStart = Date.now();
      try {
        await requestFn(index);
        const requestTime = Date.now() - requestStart;
        times.push(requestTime);
        successCount++;
      } catch (error) {
        const requestTime = Date.now() - requestStart;
        times.push(requestTime);
        errorCount++;
        errors.push(`Request ${index}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    await Promise.all(promises);

    const totalTime = Date.now() - startTime;
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;

    const result: TestResult = {
      testName,
      totalRequests: concurrentCount,
      concurrentRequests: concurrentCount,
      totalTime,
      avgTime: Math.round(avgTime),
      minTime,
      maxTime,
      successCount,
      errorCount,
      cacheHits: this.cacheStats.hits,
      cacheMisses: this.cacheStats.misses,
      errors: errors.slice(0, 5), // Limitar a 5 erros
    };

    this.results.push(result);

    console.log(`   ✅ Sucesso: ${successCount}/${concurrentCount}`);
    console.log(`   ⏱️  Tempo total: ${totalTime}ms`);
    console.log(`   📊 Tempo médio: ${Math.round(avgTime)}ms`);
    console.log(`   ⚡ Tempo mínimo: ${minTime}ms`);
    console.log(`   🐌 Tempo máximo: ${maxTime}ms`);
    if (result.cacheHits > 0 || result.cacheMisses > 0) {
      console.log(`   💾 Cache hits: ${result.cacheHits}, misses: ${result.cacheMisses}`);
    }
    if (errorCount > 0) {
      console.log(`   ❌ Erros: ${errorCount}`);
    }

    return result;
  }

  async testListUsers(concurrentCount: number = 10) {
    return await this.runConcurrentRequests(
      'Listar Usuários (com cache)',
      concurrentCount,
      async (index) => {
        const cacheKey = generateCacheKey('users:list', {
          page: Math.floor(index / 5) + 1,
          limit: 10,
        });

        // Verificar se está em cache antes
        const cachedBefore = await getCache(cacheKey);
        if (cachedBefore) {
          this.cacheStats.hits++;
        } else {
          this.cacheStats.misses++;
        }

        await getCachedOrFetch(
          cacheKey,
          async () => {
            return await prisma.usuarios.findMany({
              take: 10,
              select: getOptimizedUserSelect({
                includeRedesSociais: false,
                includeEnderecoCompleto: true,
              }),
              orderBy: { criadoEm: 'desc' },
            });
          },
          30,
        );
      },
    );
  }

  async testListInstructors(concurrentCount: number = 10) {
    return await this.runConcurrentRequests(
      'Listar Instrutores (com cache)',
      concurrentCount,
      async (index) => {
        const cacheKey = generateCacheKey('instrutores:list', {
          page: Math.floor(index / 5) + 1,
          limit: 10,
        });

        await getCachedOrFetch(
          cacheKey,
          async () => {
            this.cacheStats.misses++;
            return await prisma.usuarios.findMany({
              where: {
                role: 'INSTRUTOR',
                status: 'ATIVO',
              },
              take: 10,
              select: getOptimizedUserSelect({
                includeRedesSociais: true,
              }),
              orderBy: { criadoEm: 'desc' },
            });
          },
          30,
        );
      },
    );
  }

  async testSearchUsers(concurrentCount: number = 10) {
    const searchTerms = ['silva', 'santos', 'oliveira', 'souza', 'costa'];
    
    return await this.runConcurrentRequests(
      'Buscar Usuários por Nome (case-insensitive)',
      concurrentCount,
      async (index) => {
        const searchTerm = searchTerms[index % searchTerms.length];
        const searchFilter = optimizeSearchFilter(searchTerm);
        
        await prisma.usuarios.findMany({
          where: searchFilter,
          take: 10,
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        });
      },
    );
  }

  async testFilterByCity(concurrentCount: number = 10) {
    const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'];
    
    return await this.runConcurrentRequests(
      'Filtrar Usuários por Cidade',
      concurrentCount,
      async (index) => {
        const city = cities[index % cities.length];
        const addressFilter = optimizeAddressFilter(city, undefined);
        
        await prisma.usuarios.findMany({
          where: addressFilter || {},
          take: 10,
          select: {
            id: true,
            nomeCompleto: true,
          },
        });
      },
    );
  }

  async testMixedLoad(concurrentCount: number = 10) {
    return await this.runConcurrentRequests(
      'Carga Mista (listagens + buscas + filtros)',
      concurrentCount,
      async (index) => {
        const testType = index % 4;
        
        switch (testType) {
          case 0:
            // Listar usuários
            await prisma.usuarios.findMany({
              take: 10,
              select: getOptimizedUserSelect(),
              orderBy: { criadoEm: 'desc' },
            });
            break;
          case 1:
            // Listar instrutores
            await prisma.usuarios.findMany({
              where: { role: 'INSTRUTOR' },
              take: 10,
              select: getOptimizedUserSelect(),
            });
            break;
          case 2:
            // Buscar por nome
            await prisma.usuarios.findMany({
              where: optimizeSearchFilter('silva'),
              take: 10,
            });
            break;
          case 3:
            // Filtrar por cidade
            await prisma.usuarios.findMany({
              where: optimizeAddressFilter('São Paulo', undefined) || {},
              take: 10,
            });
            break;
        }
      },
    );
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO DOS TESTES DE CARGA');
    console.log('='.repeat(80));

    this.results.forEach((result) => {
      console.log(`\n${result.testName}:`);
      console.log(`  Requisições: ${result.totalRequests}`);
      console.log(`  Sucesso: ${result.successCount} | Erros: ${result.errorCount}`);
      console.log(`  Tempo total: ${result.totalTime}ms`);
      console.log(`  Tempo médio: ${result.avgTime}ms`);
      console.log(`  Tempo mínimo: ${result.minTime}ms`);
      console.log(`  Tempo máximo: ${result.maxTime}ms`);
      if (result.cacheHits > 0 || result.cacheMisses > 0) {
        const cacheHitRate = ((result.cacheHits / (result.cacheHits + result.cacheMisses)) * 100).toFixed(1);
        console.log(`  Cache: ${result.cacheHits} hits, ${result.cacheMisses} misses (${cacheHitRate}% hit rate)`);
      }
      if (result.errors.length > 0) {
        console.log(`  Erros: ${result.errors.join(', ')}`);
      }
    });

    // Estatísticas do profiler
    console.log('\n' + '='.repeat(80));
    console.log('📈 ESTATÍSTICAS DO PROFILER');
    console.log('='.repeat(80));
    const stats = QueryProfiler.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // Análise de performance
    console.log('\n' + '='.repeat(80));
    console.log('✅ ANÁLISE DE PERFORMANCE');
    console.log('='.repeat(80));
    
    const avgTimes = this.results.map(r => r.avgTime);
    const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
    const maxTime = Math.max(...this.results.map(r => r.maxTime));
    
    console.log(`Tempo médio geral: ${Math.round(overallAvg)}ms`);
    console.log(`Tempo máximo: ${maxTime}ms`);
    
    if (overallAvg < 500) {
      console.log('✅ Performance EXCELENTE (< 500ms)');
    } else if (overallAvg < 1000) {
      console.log('⚠️  Performance BOA (< 1000ms)');
    } else {
      console.log('❌ Performance PRECISA MELHORAR (> 1000ms)');
    }
  }
}

async function runLoadTests() {
  console.log('🚀 Iniciando Testes de Carga...');
  console.log('='.repeat(80));

  const tester = new LoadTester();

  try {
    // Teste 1: Listar usuários (10 requisições simultâneas)
    await tester.testListUsers(10);

    // Teste 2: Listar instrutores (10 requisições simultâneas)
    await tester.testListInstructors(10);

    // Teste 3: Buscar usuários (10 requisições simultâneas)
    await tester.testSearchUsers(10);

    // Teste 4: Filtrar por cidade (10 requisições simultâneas)
    await tester.testFilterByCity(10);

    // Teste 5: Carga mista (10 requisições simultâneas)
    await tester.testMixedLoad(10);

    // Imprimir resumo
    tester.printSummary();

    console.log('\n✅ Testes de carga concluídos!');

  } catch (error) {
    console.error('❌ Erro ao executar testes de carga:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar testes
runLoadTests().catch(console.error);

