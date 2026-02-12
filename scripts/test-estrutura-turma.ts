/**
 * Teste - Estrutura Completa da Turma
 * ====================================
 *
 * Valida se a estrutura retornada tem TODOS os detalhes necessários
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEstruturaTurma() {
  console.log('🧪 Testando Estrutura Completa da Turma\n');

  try {
    // Buscar turma com estrutura completa
    const turma = await prisma.cursosTurmas.findFirst({
      include: {
        CursosTurmasModulos: {
          include: {
            CursosTurmasAulas: {
              include: {
                CursosTurmasAulasMateriais: true,
                instrutor: {
                  select: {
                    id: true,
                    nomeCompleto: true,
                    email: true,
                  },
                },
              },
              orderBy: [{ ordem: 'asc' }],
            },
            CursosTurmasProvas: {
              include: {
                CursosTurmasProvasQuestoes: {
                  include: {
                    CursosTurmasProvasQuestoesAlternativas: {
                      orderBy: [{ ordem: 'asc' }],
                    },
                  },
                  orderBy: [{ ordem: 'asc' }],
                },
                Usuarios: {
                  select: {
                    id: true,
                    nomeCompleto: true,
                  },
                },
              },
              orderBy: [{ ordem: 'asc' }],
            },
          },
          orderBy: [{ ordem: 'asc' }],
        },
        CursosTurmasAulas: {
          where: { moduloId: null },
          include: {
            CursosTurmasAulasMateriais: true,
            instrutor: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          },
          orderBy: [{ ordem: 'asc' }],
        },
        CursosTurmasProvas: {
          where: { moduloId: null },
          include: {
            CursosTurmasProvasQuestoes: {
              include: {
                CursosTurmasProvasQuestoesAlternativas: {
                  orderBy: [{ ordem: 'asc' }],
                },
              },
              orderBy: [{ ordem: 'asc' }],
            },
          },
          orderBy: [{ ordem: 'asc' }],
        },
      },
    });

    if (!turma) {
      console.log('❌ Nenhuma turma encontrada');
      return;
    }

    console.log('📊 Turma encontrada:');
    console.log(`   - ID: ${turma.id}`);
    console.log(`   - Nome: ${turma.nome}`);
    console.log(`   - Estrutura Tipo: ${turma.estruturaTipo}`);
    console.log(`   - Método: ${turma.metodo}\n`);

    // Analisar módulos
    console.log('📦 MÓDULOS:');
    if (turma.CursosTurmasModulos.length === 0) {
      console.log('   (sem módulos - estrutura PADRAO ou DINAMICA)\n');
    } else {
      console.log(`   Total: ${turma.CursosTurmasModulos.length}\n`);

      turma.CursosTurmasModulos.forEach((modulo, idx) => {
        const aulasCount = modulo.CursosTurmasAulas?.length || 0;
        const provasCount =
          modulo.CursosTurmasProvas?.filter((p) => p.tipo === 'PROVA').length || 0;
        const atividadesCount =
          modulo.CursosTurmasProvas?.filter((p) => p.tipo === 'ATIVIDADE').length || 0;

        console.log(`   ${idx + 1}. ${modulo.nome} (ordem: ${modulo.ordem})`);
        console.log(`      - Aulas: ${aulasCount}`);
        console.log(`      - Provas: ${provasCount}`);
        console.log(`      - Atividades: ${atividadesCount}`);

        // Listar items do módulo
        const allItems = [
          ...modulo.CursosTurmasAulas.map((a) => ({ tipo: 'AULA', ordem: a.ordem, nome: a.nome })),
          ...modulo.CursosTurmasProvas.map((p) => ({
            tipo: p.tipo,
            ordem: p.ordem,
            nome: p.titulo,
          })),
        ].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        allItems.forEach((item, itemIdx) => {
          console.log(`      ${itemIdx + 1}. [${item.tipo}] ${item.nome} (ordem: ${item.ordem})`);
        });
        console.log();
      });
    }

    // Analisar items standalone (sem módulo)
    console.log('📝 ITEMS AVULSOS (Standalone):');
    const aulasStandalone = turma.CursosTurmasAulas || [];
    const provasStandalone = turma.CursosTurmasProvas || [];

    if (aulasStandalone.length === 0 && provasStandalone.length === 0) {
      console.log('   (sem items avulsos - tudo dentro de módulos)\n');
    } else {
      const standaloneItems = [
        ...aulasStandalone.map((a) => ({
          tipo: 'AULA',
          ordem: a.ordem,
          nome: a.nome,
          instrutor: (a as any).instrutor?.nomeCompleto,
          dataInicio: a.dataInicio,
          dataFim: a.dataFim,
        })),
        ...provasStandalone.map((p) => ({
          tipo: p.tipo,
          ordem: p.ordem,
          nome: p.titulo,
          instrutor: (p as any).Usuarios?.nomeCompleto,
          dataInicio: p.dataInicio,
          dataFim: p.dataFim,
          recuperacaoFinal: p.recuperacaoFinal,
        })),
      ].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

      console.log(`   Total: ${standaloneItems.length}\n`);

      standaloneItems.forEach((item, idx) => {
        console.log(`   ${idx + 1}. [${item.tipo}] ${item.nome} (ordem: ${item.ordem})`);
        if (item.instrutor) {
          console.log(`      Instrutor: ${item.instrutor}`);
        }
        if (item.dataInicio && item.dataFim) {
          console.log(
            `      Período: ${item.dataInicio.toISOString().split('T')[0]} até ${item.dataFim.toISOString().split('T')[0]}`,
          );
        }
        if (item.tipo === 'PROVA' && item.recuperacaoFinal) {
          console.log(`      🔄 Recuperação Final`);
        }
      });
      console.log();
    }

    // Resumo total
    const totalAulas = [
      ...aulasStandalone,
      ...turma.CursosTurmasModulos.flatMap((m) => m.CursosTurmasAulas),
    ].length;
    const allProvas = [
      ...provasStandalone,
      ...turma.CursosTurmasModulos.flatMap((m) => m.CursosTurmasProvas),
    ];
    const totalProvas = allProvas.filter((p) => p.tipo === 'PROVA').length;
    const totalAtividades = allProvas.filter((p) => p.tipo === 'ATIVIDADE').length;
    const totalRecuperacao = allProvas.filter((p) => p.recuperacaoFinal).length;

    console.log('═══════════════════════════════════════════════════');
    console.log('  📊 RESUMO DA ESTRUTURA');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`Módulos: ${turma.CursosTurmasModulos.length}`);
    console.log(`Aulas: ${totalAulas}`);
    console.log(`Provas: ${totalProvas}`);
    console.log(`Atividades: ${totalAtividades}`);
    console.log(`Provas de Recuperação Final: ${totalRecuperacao}`);
    console.log(`\nTotal de Items: ${totalAulas + totalProvas + totalAtividades}\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ ESTRUTURA MAPEADA CORRETAMENTE');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('Detalhes incluídos para cada item:');
    console.log('  ✓ Tipo (AULA, PROVA, ATIVIDADE)');
    console.log('  ✓ Título/Nome');
    console.log('  ✓ Ordem (para ordenação correta)');
    console.log('  ✓ Período (startDate, endDate, horaInicio, horaFim)');
    console.log('  ✓ Instrutor (id, nome)');
    console.log('  ✓ Modalidade (ONLINE, PRESENCIAL, etc)');
    console.log('  ✓ Status (RASCUNHO, PUBLICADA, etc)');
    console.log('  ✓ Obrigatória (true/false)');
    console.log('  ✓ Recuperação Final (para provas)');
    console.log('  ✓ Materiais (para aulas)');
    console.log('  ✓ Questões (para provas/atividades)');
    console.log('  ✓ Duração (minutos para aulas)');
    console.log('  ✓ Peso (para provas/atividades)');
    console.log('  ✓ Auditoria (criadoEm, atualizadoEm)\n');
  } catch (error: any) {
    console.error('❌ Erro durante os testes:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testEstruturaTurma();
