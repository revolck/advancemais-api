import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function validateTurmaVagas() {
  // ✅ Usar DIRECT_URL para scripts (conexão direta, sem pooler)
  // Isso evita problemas de timeout do pool de conexões
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

  const prisma = new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  const turmaCodigo = 'GEST-PROJ-T1';

  try {
    console.log('🔍 VALIDAÇÃO DE VAGAS E INSCRIÇÕES\n');
    console.log('='.repeat(60));
    console.log(`📚 Turma: ${turmaCodigo}\n`);

    // Buscar a turma
    const turma = await prisma.cursosTurmas.findUnique({
      where: { codigo: turmaCodigo },
      select: {
        id: true,
        codigo: true,
        nome: true,
        cursoId: true,
        vagasTotais: true,
        vagasDisponiveis: true,
        status: true,
        Cursos: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
      },
    });

    if (!turma) {
      console.error(`❌ Turma "${turmaCodigo}" não encontrada!`);
      process.exit(1);
    }

    console.log('✅ Turma encontrada:');
    console.log(`   ID: ${turma.id}`);
    console.log(`   Nome: ${turma.nome}`);
    console.log(`   Curso: ${turma.Cursos.nome} (${turma.Cursos.codigo})`);
    console.log(`   Status: ${turma.status}`);
    console.log(`   Vagas Totais: ${turma.vagasTotais}`);
    console.log(`   Vagas Disponíveis (banco): ${turma.vagasDisponiveis}`);
    console.log('');

    // Contar inscrições reais
    const totalInscricoes = await prisma.cursosTurmasInscricoes.count({
      where: { turmaId: turma.id },
    });

    const inscricoesPorStatus = await prisma.cursosTurmasInscricoes.groupBy({
      by: ['status'],
      where: { turmaId: turma.id },
      _count: { status: true },
    });

    console.log('📊 INSCRIÇÕES:');
    console.log(`   Total de inscrições: ${totalInscricoes}`);
    console.log('   Por status:');
    inscricoesPorStatus.forEach((item) => {
      console.log(`     - ${item.status}: ${item._count.status}`);
    });
    console.log('');

    // Calcular vagas disponíveis esperadas
    const vagasDisponiveisEsperadas = turma.vagasTotais - totalInscricoes;
    const diferenca = turma.vagasDisponiveis - vagasDisponiveisEsperadas;

    console.log('🔢 CÁLCULO:');
    console.log(`   Vagas Totais: ${turma.vagasTotais}`);
    console.log(`   Inscrições: ${totalInscricoes}`);
    console.log(`   Vagas Disponíveis Esperadas: ${vagasDisponiveisEsperadas}`);
    console.log(`   Vagas Disponíveis no Banco: ${turma.vagasDisponiveis}`);
    console.log(`   Diferença: ${diferenca}`);
    console.log('');

    // Validação
    if (diferenca === 0) {
      console.log('✅ CONSISTÊNCIA: OK!');
      console.log('   As vagas disponíveis estão corretas.');
    } else {
      console.log('⚠️  INCONSISTÊNCIA DETECTADA!');
      console.log(`   Diferença: ${diferenca}`);
      if (diferenca > 0) {
        console.log('   O banco mostra MAIS vagas disponíveis do que deveria.');
      } else {
        console.log('   O banco mostra MENOS vagas disponíveis do que deveria.');
      }
      console.log('');
      console.log('💡 SOLUÇÃO:');
      console.log('   Execute a atualização das vagas:');
      console.log(
        `   UPDATE "CursosTurmas" SET "vagasDisponiveis" = ${vagasDisponiveisEsperadas} WHERE id = '${turma.id}';`,
      );
    }

    // Listar alunos inscritos
    if (totalInscricoes > 0) {
      console.log('');
      console.log('👥 ALUNOS INSCRITOS:');
      const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
        where: { turmaId: turma.id },
        select: {
          id: true,
          status: true,
          criadoEm: true,
          Usuarios: {
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });

      inscricoes.forEach((inscricao, index) => {
        console.log(`   ${index + 1}. ${inscricao.Usuarios.nomeCompleto}`);
        console.log(`      Código: ${inscricao.Usuarios.codUsuario}`);
        console.log(`      Email: ${inscricao.Usuarios.email}`);
        console.log(`      Status: ${inscricao.status}`);
        console.log(`      Inscrito em: ${inscricao.criadoEm.toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('👥 NENHUM ALUNO INSCRITO');
      console.log('   A turma está vazia, o que explica 0/30 vagas.');
    }

    console.log('');
    console.log('='.repeat(60));

    process.exit(diferenca === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('❌ ERRO:', error.message);
    if (error.message?.includes('connection pool')) {
      console.error('\n💡 ERRO DE POOL DE CONEXÕES:');
      console.error('   - Verifique se DIRECT_URL está configurado no .env');
      console.error('   - Verifique se há muitas conexões abertas no banco');
      console.error('   - Aguarde alguns segundos e tente novamente');
    }
    console.error(error);
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // Ignorar erros ao desconectar
    }
  }
}

validateTurmaVagas();
