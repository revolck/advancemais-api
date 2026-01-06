/**
 * Script para testar performance com e sem cache
 */

import { prisma } from '../src/config/prisma';
import { Roles, TiposDeUsuarios } from '@prisma/client';
import redis from '../src/config/redis';

async function testCache() {
  console.log('🚀 Testando performance com cache Redis...\n');

  try {
    // Buscar empresa
    const empresa = await prisma.usuarios.findFirst({
      where: {
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      },
      select: {
        id: true,
        nomeCompleto: true,
      },
    });

    if (!empresa) {
      console.log('❌ Nenhuma empresa encontrada');
      return;
    }

    console.log(`✅ Empresa: ${empresa.nomeCompleto}\n`);

    const { dashboardService } = await import(
      '../src/modules/empresas/dashboard/services/dashboard.service'
    );

    // Limpar cache
    const cacheKey = `dashboard:metricas:${empresa.id}:30d`;
    await redis.del(cacheKey);
    console.log('🗑️  Cache limpo\n');

    // Primeira chamada (sem cache)
    console.log('📊 Primeira chamada (SEM CACHE):');
    const inicio1 = Date.now();
    await dashboardService.getMetricas(empresa.id, '30d');
    const tempo1 = Date.now() - inicio1;
    console.log(`   ⏱️  Tempo: ${tempo1}ms\n`);

    // Segunda chamada (com cache)
    console.log('📊 Segunda chamada (COM CACHE):');
    const inicio2 = Date.now();
    await dashboardService.getMetricas(empresa.id, '30d');
    const tempo2 = Date.now() - inicio2;
    console.log(`   ⏱️  Tempo: ${tempo2}ms\n`);

    // Comparação
    const melhoria = (((tempo1 - tempo2) / tempo1) * 100).toFixed(1);
    console.log(`📈 Resultado:`);
    console.log(`   - Sem cache: ${tempo1}ms`);
    console.log(`   - Com cache: ${tempo2}ms`);
    console.log(`   - Melhoria: ${melhoria}% mais rápido`);
    console.log(`   - Diferença: ${tempo1 - tempo2}ms economizados\n`);

    if (tempo2 < 100) {
      console.log('🚀 EXCELENTE! Cache funcionando perfeitamente!');
    } else if (tempo2 < 500) {
      console.log('✅ BOM! Cache melhorando significativamente a performance');
    } else {
      console.log('⚠️  Cache pode não estar funcionando corretamente');
    }

    // Verificar TTL
    const ttl = await redis.ttl(cacheKey);
    console.log(`\n⏱️  TTL do cache: ${ttl} segundos (${Math.floor(ttl / 60)} minutos)`);
  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

testCache()
  .then(() => {
    console.log('\n✅ Teste concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Teste falhou:', error);
    process.exit(1);
  });
