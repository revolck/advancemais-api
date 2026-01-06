/**
 * Script para testar o endpoint de métricas via HTTP real
 * Simula uma requisição do frontend
 */

import { prisma } from '../src/config/prisma';
import { Roles, TiposDeUsuarios } from '@prisma/client';

async function testDashboardHTTP() {
  console.log('🔍 Testando endpoint de métricas via HTTP...\n');

  try {
    // 1. Buscar uma empresa
    const empresa = await prisma.usuarios.findFirst({
      where: {
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    });

    if (!empresa) {
      console.log('❌ Nenhuma empresa encontrada');
      return;
    }

    console.log(`✅ Empresa encontrada: ${empresa.nomeCompleto}`);
    console.log(`   Email: ${empresa.email}`);
    console.log(`   ID: ${empresa.id}\n`);

    // 2. Buscar o authId da empresa
    const usuarioCompleto = await prisma.usuarios.findUnique({
      where: { id: empresa.id },
      select: {
        authId: true,
      },
    });

    console.log(`🔑 Auth ID: ${usuarioCompleto?.authId || 'Não encontrado'}\n`);

    // 3. Fazer requisição direta ao serviço (sem HTTP)
    console.log('📊 Testando serviço diretamente (sem HTTP)...');

    const { dashboardService } = await import(
      '../src/modules/empresas/dashboard/services/dashboard.service'
    );

    const periodos = ['30d'] as const;

    for (const periodo of periodos) {
      console.log(`\n⏱️  Testando período: ${periodo}`);

      const inicio = Date.now();

      try {
        const resultado = await dashboardService.getMetricas(empresa.id, periodo);

        const tempo = Date.now() - inicio;

        console.log(`✅ Resposta recebida em ${tempo}ms`);
        console.log(`\n📈 Resumo das métricas:`);
        console.log(`   - Vagas publicadas: ${resultado.metricasGerais.vagasPublicadas}`);
        console.log(`   - Total candidaturas: ${resultado.metricasGerais.totalCandidaturas}`);
        console.log(`   - Candidatos por vaga: ${resultado.candidatosPorVaga.length} vagas`);
        console.log(
          `   - Status de candidaturas: ${resultado.candidaturasPorStatus.length} status`,
        );
        console.log(`   - Timeline: ${resultado.candidaturasTimeline.length} pontos`);

        if (tempo > 5000) {
          console.log(`\n⚠️  ATENÇÃO: Tempo de resposta muito alto (${tempo}ms)`);
          console.log(`   Recomendações:`);
          console.log(`   - Verificar índices no banco de dados`);
          console.log(`   - Implementar cache (Redis)`);
          console.log(`   - Otimizar queries SQL`);
        } else if (tempo > 2000) {
          console.log(`\n⚠️  Tempo de resposta alto (${tempo}ms)`);
          console.log(`   Considere implementar cache`);
        } else if (tempo > 1000) {
          console.log(`\n✅ Tempo de resposta aceitável (${tempo}ms)`);
        } else {
          console.log(`\n🚀 Tempo de resposta excelente (${tempo}ms)`);
        }

        // Verificar se há muitos dados
        const totalDados =
          resultado.candidatosPorVaga.length +
          resultado.candidaturasPorStatus.length +
          resultado.candidaturasTimeline.length +
          resultado.vagasPorStatus.length +
          resultado.candidaturasPorOrigem.length +
          resultado.topVagas.length;

        console.log(`\n📊 Total de dados retornados: ${totalDados} registros`);

        if (totalDados > 1000) {
          console.log(`⚠️  Muitos dados sendo retornados (${totalDados})`);
          console.log(`   Considere adicionar paginação`);
        }
      } catch (error) {
        const tempo = Date.now() - inicio;
        console.log(`❌ Erro após ${tempo}ms:`);
        console.log(`   ${error instanceof Error ? error.message : String(error)}`);

        if (error instanceof Error && error.message.includes('timeout')) {
          console.log(`\n🔍 Diagnóstico de TIMEOUT:`);
          console.log(`   1. Verificar se há muitas candidaturas no banco`);
          console.log(`   2. Verificar se há índices nas tabelas`);
          console.log(`   3. Considerar adicionar limite nas queries`);
          console.log(`   4. Implementar cache para métricas`);
        }
      }
    }

    console.log('\n\n🔍 Diagnóstico de Performance:\n');

    // Contar registros no banco
    const [totalVagas, totalCandidaturas, totalStatus] = await Promise.all([
      prisma.empresasVagas.count({ where: { usuarioId: empresa.id } }),
      prisma.empresasCandidatos.count({ where: { empresaUsuarioId: empresa.id } }),
      prisma.status_processo.count(),
    ]);

    console.log(`📊 Quantidade de dados:`);
    console.log(`   - Total de vagas da empresa: ${totalVagas}`);
    console.log(`   - Total de candidaturas: ${totalCandidaturas}`);
    console.log(`   - Total de status no sistema: ${totalStatus}`);

    if (totalCandidaturas > 10000) {
      console.log(`\n⚠️  ATENÇÃO: Muitas candidaturas (${totalCandidaturas})`);
      console.log(`   Recomendações:`);
      console.log(`   - Implementar limite nas queries (top 100)`);
      console.log(`   - Adicionar cache com TTL de 5 minutos`);
      console.log(`   - Considerar pré-calcular métricas em tabela separada`);
    }

    // Verificar índices
    console.log(`\n🔍 Verificando índices importantes...`);

    const indices = await prisma.$queryRaw<{ tablename: string; indexname: string }[]>`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('EmpresasCandidatos', 'EmpresasVagas', 'status_processo')
      ORDER BY tablename, indexname
    `;

    const tabelasComIndices = new Set(indices.map((i) => i.tablename));

    console.log(`\n✅ Tabelas com índices:`);
    tabelasComIndices.forEach((tabela) => {
      const indicesTabela = indices.filter((i) => i.tablename === tabela);
      console.log(`   - ${tabela}: ${indicesTabela.length} índices`);
    });

    // Verificar índices específicos necessários
    const indicesNecessarios = [
      'EmpresasCandidatos_empresaUsuarioId_idx',
      'EmpresasCandidatos_statusId_idx',
      'EmpresasCandidatos_vagaId_idx',
      'EmpresasVagas_usuarioId_idx',
      'EmpresasVagas_status_idx',
    ];

    const indicesEncontrados = indices.map((i) => i.indexname);
    const indicesFaltando = indicesNecessarios.filter((i) => !indicesEncontrados.includes(i));

    if (indicesFaltando.length > 0) {
      console.log(`\n⚠️  Índices faltando (podem causar lentidão):`);
      indicesFaltando.forEach((i) => console.log(`   - ${i}`));
    } else {
      console.log(`\n✅ Todos os índices importantes estão presentes`);
    }
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testDashboardHTTP()
  .then(() => {
    console.log('\n✅ Teste finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Teste falhou:', error);
    process.exit(1);
  });
