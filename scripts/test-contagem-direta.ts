/**
 * Script para testar contagem direta no Prisma
 * Verifica se há algum problema com filtros implícitos
 */

import 'dotenv/config';
import { prisma } from '../src/config/prisma';

async function testContagemDireta() {
  console.log('🔍 Testando contagem direta no Prisma...\n');

  try {
    // 1. Contagem total sem filtros
    const totalSemFiltros = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
      },
    });
    console.log(`✅ Total sem filtros (deletedAt IS NULL): ${totalSemFiltros}`);

    // 2. Contagem de aulas com turma
    const aulasComTurma = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        turmaId: { not: null },
      },
    });
    console.log(`📊 Aulas com turma (turmaId IS NOT NULL): ${aulasComTurma}`);

    // 3. Contagem de aulas sem turma
    const aulasSemTurma = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        turmaId: null,
      },
    });
    console.log(`📊 Aulas sem turma (turmaId IS NULL): ${aulasSemTurma}`);

    // 4. Verificar soma
    const soma = aulasComTurma + aulasSemTurma;
    console.log(`📊 Soma (com turma + sem turma): ${soma}`);
    console.log(`📊 Total esperado: 46`);

    if (soma !== totalSemFiltros) {
      console.log(`\n⚠️  Diferença encontrada: ${totalSemFiltros - soma}`);
    }

    // 5. Testar com relacionamento (simulando a query real)
    const totalComRelacionamento = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        CursosTurmas: {
          // Sem filtro - deve incluir todas as aulas
        },
      },
    });
    console.log(`\n⚠️  Total com relacionamento CursosTurmas (sem filtro): ${totalComRelacionamento}`);

    // 6. Testar com relacionamento IS NOT NULL (pode estar filtrando)
    const totalComTurmaNotNull = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        CursosTurmas: {
          isNot: null,
        },
      },
    });
    console.log(`⚠️  Total com CursosTurmas IS NOT NULL: ${totalComTurmaNotNull}`);

    // 7. Verificar se há algum problema com o relacionamento
    console.log('\n🔍 Análise:');
    if (totalComRelacionamento !== totalSemFiltros) {
      console.log(`   ❌ PROBLEMA: Relacionamento está filtrando ${totalSemFiltros - totalComRelacionamento} aulas`);
    }
    if (totalComTurmaNotNull !== aulasComTurma) {
      console.log(`   ⚠️  CursosTurmas IS NOT NULL retorna ${totalComTurmaNotNull}, mas aulas com turma são ${aulasComTurma}`);
    }

    // 8. Verificar se o problema está no count vs findMany
    const aulasFindMany = await prisma.cursosTurmasAulas.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        CursosTurmas: {
          select: {
            id: true,
          },
        },
      },
    });
    console.log(`\n📊 Total usando findMany com include: ${aulasFindMany.length}`);

    if (aulasFindMany.length !== totalSemFiltros) {
      console.log(`   ❌ PROBLEMA: findMany retorna ${aulasFindMany.length}, mas count retorna ${totalSemFiltros}`);
    }

    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro ao executar testes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testContagemDireta();

