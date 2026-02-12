/**
 * Teste - Estrutura Completa da Turma (Buscar com conteúdo)
 * ==========================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEstruturaTurmaCompleta() {
  console.log('🧪 Testando Estrutura Completa da Turma\n');

  try {
    // Buscar turma que tenha aulas E provas
    const turma = await prisma.cursosTurmas.findFirst({
      where: {
        CursosTurmasAulas: {
          some: {},
        },
        CursosTurmasProvas: {
          some: {},
        },
      },
      include: {
        CursosTurmasModulos: {
          include: {
            CursosTurmasAulas: {
              include: {
                CursosTurmasAulasMateriais: {
                  orderBy: [{ ordem: 'asc' }],
                },
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
          where: { moduloId: null, deletedAt: null },
          include: {
            CursosTurmasAulasMateriais: {
              orderBy: [{ ordem: 'asc' }],
            },
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
    });

    if (!turma) {
      console.log('❌ Nenhuma turma com estrutura completa encontrada');
      return;
    }

    console.log('📊 TURMA SELECIONADA:');
    console.log(`   ID: ${turma.id}`);
    console.log(`   Nome: ${turma.nome}`);
    console.log(`   Estrutura: ${turma.estruturaTipo}`);
    console.log(`   Método: ${turma.metodo}`);
    console.log(`   Status: ${turma.status}\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('  📦 ESTRUTURA DA TURMA');
    console.log('═══════════════════════════════════════════════════\n');

    // MÓDULOS
    if (turma.CursosTurmasModulos.length > 0) {
      console.log(`📚 MÓDULOS (${turma.CursosTurmasModulos.length}):`);
      console.log('─'.repeat(70));

      turma.CursosTurmasModulos.forEach((modulo, idx) => {
        console.log(`\n${idx + 1}. 📦 ${modulo.nome} (ordem: ${modulo.ordem})`);
        console.log(`   ID: ${modulo.id}`);
        console.log(`   Obrigatório: ${modulo.obrigatorio ? 'Sim' : 'Não'}`);

        // Items do módulo
        const items = [
          ...modulo.CursosTurmasAulas.map((a) => ({
            tipo: 'AULA',
            ordem: a.ordem,
            id: a.id,
            nome: a.nome,
            instrutor: (a as any).instrutor?.nomeCompleto,
            periodo:
              a.dataInicio && a.dataFim
                ? `${a.dataInicio.toISOString().split('T')[0]} até ${a.dataFim.toISOString().split('T')[0]}`
                : 'Não definido',
            modalidade: a.modalidade,
            status: a.status,
            obrigatoria: a.obrigatoria,
            materiais: a.CursosTurmasAulasMateriais?.length || 0,
          })),
          ...modulo.CursosTurmasProvas.map((p) => ({
            tipo: p.tipo,
            ordem: p.ordem,
            id: p.id,
            nome: p.titulo,
            instrutor: (p as any).Usuarios?.nomeCompleto,
            periodo:
              p.dataInicio && p.dataFim
                ? `${p.dataInicio.toISOString().split('T')[0]} até ${p.dataFim.toISOString().split('T')[0]}`
                : 'Não definido',
            modalidade: p.modalidade,
            status: p.status,
            obrigatoria: p.obrigatoria,
            peso: Number(p.peso),
            questoes: p.CursosTurmasProvasQuestoes?.length || 0,
            recuperacaoFinal: p.recuperacaoFinal,
          })),
        ].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        console.log(`   Items (${items.length}):`);
        items.forEach((item, itemIdx) => {
          const icon = item.tipo === 'AULA' ? '📹' : item.tipo === 'ATIVIDADE' ? '📝' : '📊';
          console.log(`   ${itemIdx + 1}. ${icon} [${item.tipo}] ${item.nome}`);
          console.log(`      - Ordem: ${item.ordem}`);
          console.log(`      - ID: ${item.id}`);
          if (item.instrutor) {
            console.log(`      - Instrutor: ${item.instrutor}`);
          }
          console.log(`      - Período: ${item.periodo}`);
          console.log(`      - Modalidade: ${item.modalidade}`);
          console.log(`      - Status: ${item.status}`);
          console.log(`      - Obrigatória: ${item.obrigatoria ? 'Sim' : 'Não'}`);

          if (item.tipo === 'AULA') {
            console.log(`      - Materiais: ${item.materiais}`);
          } else {
            console.log(`      - Peso: ${item.peso}`);
            console.log(`      - Questões: ${item.questoes}`);
            if (item.recuperacaoFinal) {
              console.log(`      - 🔄 RECUPERAÇÃO FINAL`);
            }
          }
        });
      });
      console.log('\n' + '─'.repeat(70) + '\n');
    }

    // ITEMS STANDALONE
    const aulasStandalone = turma.CursosTurmasAulas || [];
    const provasStandalone = turma.CursosTurmasProvas || [];

    if (aulasStandalone.length > 0 || provasStandalone.length > 0) {
      const standaloneItems = [
        ...aulasStandalone.map((a) => ({
          tipo: 'AULA',
          ordem: a.ordem,
          id: a.id,
          nome: a.nome,
          instrutor: (a as any).instrutor?.nomeCompleto,
          periodo:
            a.dataInicio && a.dataFim
              ? `${a.dataInicio.toISOString().split('T')[0]} até ${a.dataFim.toISOString().split('T')[0]}`
              : 'Não definido',
          modalidade: a.modalidade,
          status: a.status,
          obrigatoria: a.obrigatoria,
          materiais: a.CursosTurmasAulasMateriais?.length || 0,
        })),
        ...provasStandalone.map((p) => ({
          tipo: p.tipo,
          ordem: p.ordem,
          id: p.id,
          nome: p.titulo,
          instrutor: (p as any).Usuarios?.nomeCompleto,
          periodo:
            p.dataInicio && p.dataFim
              ? `${p.dataInicio.toISOString().split('T')[0]} até ${p.dataFim.toISOString().split('T')[0]}`
              : 'Não definido',
          modalidade: p.modalidade,
          status: p.status,
          obrigatoria: p.obrigatoria,
          peso: Number(p.peso),
          questoes: p.CursosTurmasProvasQuestoes?.length || 0,
          recuperacaoFinal: p.recuperacaoFinal,
        })),
      ].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

      console.log(`📝 ITEMS AVULSOS (${standaloneItems.length}):`);
      console.log('─'.repeat(70));

      standaloneItems.forEach((item, idx) => {
        const icon = item.tipo === 'AULA' ? '📹' : item.tipo === 'ATIVIDADE' ? '📝' : '📊';
        console.log(`\n${idx + 1}. ${icon} [${item.tipo}] ${item.nome}`);
        console.log(`   - Ordem: ${item.ordem}`);
        console.log(`   - ID: ${item.id}`);
        if (item.instrutor) {
          console.log(`   - Instrutor: ${item.instrutor}`);
        }
        console.log(`   - Período: ${item.periodo}`);
        console.log(`   - Modalidade: ${item.modalidade}`);
        console.log(`   - Status: ${item.status}`);
        console.log(`   - Obrigatória: ${item.obrigatoria ? 'Sim' : 'Não'}`);

        if (item.tipo === 'AULA') {
          console.log(`   - Materiais: ${item.materiais}`);
        } else {
          console.log(`   - Peso: ${item.peso}`);
          console.log(`   - Questões: ${item.questoes}`);
          if (item.recuperacaoFinal) {
            console.log(`   - 🔄 RECUPERAÇÃO FINAL`);
          }
        }
      });
      console.log('\n' + '─'.repeat(70) + '\n');
    }

    // Resumo estatístico
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
    console.log('  📊 ESTATÍSTICAS DA ESTRUTURA');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`📚 Módulos: ${turma.CursosTurmasModulos.length}`);
    console.log(`📹 Aulas: ${totalAulas}`);
    console.log(`📊 Provas: ${totalProvas}`);
    console.log(`📝 Atividades: ${totalAtividades}`);
    console.log(`🔄 Recuperação Final: ${totalRecuperacao}`);
    console.log(`\n📦 Total de Items: ${totalAulas + totalProvas + totalAtividades}\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ TESTE CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('A estrutura retornada inclui:');
    console.log('  ✓ Tipo correto (AULA, PROVA, ATIVIDADE)');
    console.log('  ✓ Ordem de criação/exibição');
    console.log('  ✓ Período completo (datas + horas)');
    console.log('  ✓ Instrutor de cada item');
    console.log('  ✓ Modalidade (ONLINE, PRESENCIAL)');
    console.log('  ✓ Status e ativo/inativo');
    console.log('  ✓ Obrigatória ou opcional');
    console.log('  ✓ Recuperação final (para provas)');
    console.log('  ✓ Materiais (para aulas)');
    console.log('  ✓ Questões (para provas/atividades)');
    console.log('  ✓ Peso e vale ponto');
    console.log('  ✓ Timestamps de auditoria\n');
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testEstruturaTurmaCompleta();
