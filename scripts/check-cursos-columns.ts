/**
 * Script para verificar se as colunas de precificação existem na tabela Cursos
 */

import { prisma } from '../src/config/prisma';

async function main() {
  console.log('🔍 Verificando colunas da tabela Cursos...\n');

  try {
    // Buscar colunas da tabela Cursos
    const columns = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Cursos' 
      ORDER BY column_name;
    `;

    console.log('📊 Colunas encontradas na tabela Cursos:');
    console.log('═'.repeat(50));
    columns.forEach((col) => {
      const isNew = ['valor', 'valorPromocional', 'gratuito'].includes(col.column_name);
      const emoji = isNew ? '🆕' : '  ';
      console.log(`${emoji} ${col.column_name.padEnd(30)} ${col.data_type}`);
    });
    console.log('═'.repeat(50));

    // Verificar se os campos de precificação existem
    const camposNecessarios = ['valor', 'valorPromocional', 'gratuito'];
    const camposEncontrados = columns.map((c) => c.column_name);
    const camposFaltando = camposNecessarios.filter((c) => !camposEncontrados.includes(c));

    if (camposFaltando.length > 0) {
      console.log('\n❌ CAMPOS FALTANDO:');
      camposFaltando.forEach((campo) => {
        console.log(`   - ${campo}`);
      });
      console.log('\n⚠️  As migrations ainda não foram aplicadas!');
      console.log('   Execute: npx prisma migrate deploy\n');
    } else {
      console.log('\n✅ Todos os campos de precificação existem!');
      console.log('   - valor ✅');
      console.log('   - valorPromocional ✅');
      console.log('   - gratuito ✅\n');

      // Testar buscar um curso
      const curso = await prisma.cursos.findFirst({
        select: {
          id: true,
          nome: true,
          valor: true,
          valorPromocional: true,
          gratuito: true,
        },
      });

      if (curso) {
        console.log('📚 Exemplo de curso:');
        console.log(`   Nome: ${curso.nome}`);
        console.log(`   Valor: R$ ${curso.valor}`);
        console.log(
          `   Valor Promocional: ${curso.valorPromocional ? `R$ ${curso.valorPromocional}` : 'N/A'}`,
        );
        console.log(`   Gratuito: ${curso.gratuito ? 'Sim' : 'Não'}\n`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar colunas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
