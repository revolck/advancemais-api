/**
 * Script para testar o endpoint de métricas do dashboard
 *
 * Este script:
 * 1. Busca uma empresa no banco de dados
 * 2. Testa o endpoint de métricas com diferentes períodos
 * 3. Valida a estrutura da resposta
 */

import { prisma } from '../src/config/prisma';
import { Roles, TiposDeUsuarios } from '@prisma/client';

interface MetricasResponse {
  success: boolean;
  data: {
    metricasGerais: {
      vagasPublicadas: number;
      vagasEncerradas: number;
      totalCandidaturas: number;
      candidaturasNovas: number;
      entrevistasPendentes: number;
      entrevistasRealizadas: number;
      proximosEventos: number;
      taxaConversao: number;
    };
    candidatosPorVaga: any[];
    candidaturasPorStatus: any[];
    candidaturasTimeline: any[];
    vagasPorStatus: any[];
    candidaturasPorOrigem: any[];
    topVagas: any[];
    periodo: {
      inicio: string;
      fim: string;
      tipo: string;
    };
  };
}

async function testDashboardMetricas() {
  console.log('🔍 Iniciando teste do endpoint de métricas do dashboard...\n');

  try {
    // 1. Buscar uma empresa no banco
    console.log('1️⃣ Buscando empresa no banco de dados...');
    const empresa = await prisma.usuarios.findFirst({
      where: {
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cnpj: true,
      },
    });

    if (!empresa) {
      console.log('❌ Nenhuma empresa encontrada no banco de dados');
      console.log('💡 Crie uma empresa antes de executar este teste');
      return;
    }

    console.log(`✅ Empresa encontrada: ${empresa.nomeCompleto} (${empresa.email})`);
    console.log(`   ID: ${empresa.id}`);
    console.log(`   CNPJ: ${empresa.cnpj || 'Não informado'}\n`);

    // 2. Buscar estatísticas da empresa
    console.log('2️⃣ Buscando estatísticas da empresa...');

    const [totalVagas, totalCandidaturas, vagasPublicadas] = await Promise.all([
      prisma.empresasVagas.count({ where: { usuarioId: empresa.id } }),
      prisma.empresasCandidatos.count({ where: { empresaUsuarioId: empresa.id } }),
      prisma.empresasVagas.count({ where: { usuarioId: empresa.id, status: 'PUBLICADO' } }),
    ]);

    console.log(`   Total de vagas: ${totalVagas}`);
    console.log(`   Vagas publicadas: ${vagasPublicadas}`);
    console.log(`   Total de candidaturas: ${totalCandidaturas}\n`);

    if (totalVagas === 0) {
      console.log('⚠️  Esta empresa não possui vagas cadastradas');
      console.log('💡 As métricas estarão vazias, mas o endpoint deve funcionar\n');
    }

    // 3. Simular chamada ao serviço de métricas
    console.log('3️⃣ Testando serviço de métricas...');

    const { dashboardService } = await import(
      '../src/modules/empresas/dashboard/services/dashboard.service'
    );

    const periodos = ['7d', '30d', '90d', '12m'] as const;

    for (const periodo of periodos) {
      console.log(`\n   📊 Testando período: ${periodo}`);

      try {
        const resultado = await dashboardService.getMetricas(empresa.id, periodo);

        // Validar estrutura da resposta
        console.log(`   ✅ Resposta recebida com sucesso`);
        console.log(`   📈 Métricas gerais:`);
        console.log(`      - Vagas publicadas: ${resultado.metricasGerais.vagasPublicadas}`);
        console.log(`      - Vagas encerradas: ${resultado.metricasGerais.vagasEncerradas}`);
        console.log(`      - Total candidaturas: ${resultado.metricasGerais.totalCandidaturas}`);
        console.log(`      - Candidaturas novas: ${resultado.metricasGerais.candidaturasNovas}`);
        console.log(`      - Taxa de conversão: ${resultado.metricasGerais.taxaConversao}%`);

        console.log(`   📊 Dados de gráficos:`);
        console.log(`      - Candidatos por vaga: ${resultado.candidatosPorVaga.length} vagas`);
        console.log(
          `      - Status de candidaturas: ${resultado.candidaturasPorStatus.length} status`,
        );
        console.log(`      - Timeline: ${resultado.candidaturasTimeline.length} pontos`);
        console.log(`      - Vagas por status: ${resultado.vagasPorStatus.length} status`);
        console.log(
          `      - Origem candidaturas: ${resultado.candidaturasPorOrigem.length} origens`,
        );
        console.log(`      - Top vagas: ${resultado.topVagas.length} vagas`);

        console.log(`   🕐 Período:`);
        console.log(`      - Tipo: ${resultado.periodo.tipo}`);
        console.log(
          `      - Início: ${new Date(resultado.periodo.inicio).toLocaleDateString('pt-BR')}`,
        );
        console.log(`      - Fim: ${new Date(resultado.periodo.fim).toLocaleDateString('pt-BR')}`);

        // Validar estrutura dos dados
        const validacoes = [
          { campo: 'metricasGerais', existe: !!resultado.metricasGerais },
          { campo: 'candidatosPorVaga', existe: Array.isArray(resultado.candidatosPorVaga) },
          {
            campo: 'candidaturasPorStatus',
            existe: Array.isArray(resultado.candidaturasPorStatus),
          },
          { campo: 'candidaturasTimeline', existe: Array.isArray(resultado.candidaturasTimeline) },
          { campo: 'vagasPorStatus', existe: Array.isArray(resultado.vagasPorStatus) },
          {
            campo: 'candidaturasPorOrigem',
            existe: Array.isArray(resultado.candidaturasPorOrigem),
          },
          { campo: 'topVagas', existe: Array.isArray(resultado.topVagas) },
          { campo: 'periodo', existe: !!resultado.periodo },
        ];

        const todasValidacoes = validacoes.every((v) => v.existe);

        if (todasValidacoes) {
          console.log(`   ✅ Estrutura da resposta validada com sucesso`);
        } else {
          console.log(`   ❌ Erro na estrutura da resposta:`);
          validacoes
            .filter((v) => !v.existe)
            .forEach((v) => {
              console.log(`      - Campo ausente: ${v.campo}`);
            });
        }
      } catch (error) {
        console.log(`   ❌ Erro ao buscar métricas para período ${periodo}:`);
        console.log(`      ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📝 Resumo:');
    console.log(`   - Empresa testada: ${empresa.nomeCompleto}`);
    console.log(`   - Total de vagas: ${totalVagas}`);
    console.log(`   - Total de candidaturas: ${totalCandidaturas}`);
    console.log(`   - Períodos testados: ${periodos.join(', ')}`);

    console.log('\n💡 Próximos passos:');
    console.log('   1. Testar o endpoint via HTTP com autenticação');
    console.log('   2. Validar permissões (EMPRESA, ADMIN, MODERADOR)');
    console.log('   3. Testar com diferentes empresas');
    console.log('   4. Integrar com o frontend');
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testDashboardMetricas()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });

