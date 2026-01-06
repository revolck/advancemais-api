/**
 * Script para testar contagem de aulas
 * Executa queries diretas no Prisma para identificar o problema
 */

import 'dotenv/config';
import { prisma } from '../src/config/prisma';

async function testContagemAulas() {
  console.log('🔍 Testando contagem de aulas...\n');

  try {
    // 1. Contagem total sem filtros
    const totalSemFiltros = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
      },
    });
    console.log(`✅ Total sem filtros (deletedAt IS NULL): ${totalSemFiltros}`);

    // 2. Contagem com include (simulando a query real)
    const totalComInclude = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
      },
    });
    console.log(`✅ Total com include (deve ser igual): ${totalComInclude}`);

    // 3. Verificar aulas sem turma
    const aulasSemTurma = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        turmaId: null,
      },
    });
    console.log(`📊 Aulas sem turma (turmaId IS NULL): ${aulasSemTurma}`);

    // 4. Verificar aulas com turma
    const aulasComTurma = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        turmaId: { not: null },
      },
    });
    console.log(`📊 Aulas com turma (turmaId IS NOT NULL): ${aulasComTurma}`);

    // 5. Verificar total de turmas
    const totalTurmas = await prisma.cursosTurmas.count();
    console.log(`📊 Total de turmas: ${totalTurmas}`);

    // 7. Testar query com include (como na API)
    const queryComInclude = await prisma.cursosTurmasAulas.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        CursosTurmas: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
      },
      take: 5,
    });
    console.log(`\n📋 Primeiras 5 aulas com include:`);
    queryComInclude.forEach((aula, index) => {
      console.log(
        `  ${index + 1}. ${aula.codigo} - Turma: ${aula.CursosTurmas?.nome || 'SEM TURMA'}`,
      );
    });

    // 8. Verificar se há algum problema com relacionamento
    const totalComRelacionamento = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        CursosTurmas: {
          // Sem filtro aqui - deve incluir todas as aulas
        },
      },
    });
    console.log(
      `\n⚠️  Total com relacionamento CursosTurmas (sem filtro): ${totalComRelacionamento}`,
    );

    // 9. Verificar se há filtro implícito quando CursosTurmas é null
    const totalComTurmaNotNull = await prisma.cursosTurmasAulas.count({
      where: {
        deletedAt: null,
        CursosTurmas: {
          isNot: null,
        },
      },
    });
    console.log(`⚠️  Total com CursosTurmas IS NOT NULL: ${totalComTurmaNotNull}`);

    console.log('\n✅ Testes concluídos!');
    console.log('\n📊 Resumo:');
    console.log(`  Total esperado: 46`);
    console.log(`  Total encontrado: ${totalSemFiltros}`);
    console.log(`  Diferença: ${46 - totalSemFiltros}`);
    console.log(`  Aulas sem turma: ${aulasSemTurma}`);
    console.log(`  Aulas com turma: ${aulasComTurma}`);

    if (totalSemFiltros !== 46) {
      console.log('\n❌ PROBLEMA IDENTIFICADO:');
      console.log(`  A contagem está retornando ${totalSemFiltros} em vez de 46`);
      console.log(`  Diferença de ${46 - totalSemFiltros} registros`);
    }
  } catch (error) {
    console.error('❌ Erro ao executar testes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testContagemAulas();
