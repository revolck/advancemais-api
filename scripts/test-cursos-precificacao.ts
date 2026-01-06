/**
 * Script para testar a rota de listagem de cursos e verificar
 * se os campos de precificação estão sendo retornados corretamente
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testCursosPrecificacao() {
  console.log('🧪 Testando rota GET /api/v1/cursos?page=1&pageSize=10\n');
  console.log('═'.repeat(80));

  try {
    const url = new URL(`${API_BASE_URL}/api/v1/cursos`);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '10');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    const { data, pagination } = responseData;

    console.log(`✅ Resposta recebida com sucesso!`);
    console.log(`📊 Total de cursos: ${pagination?.total || data?.length || 0}`);
    console.log(`📄 Página: ${pagination?.page || 1}`);
    console.log(`📏 Itens por página: ${pagination?.pageSize || 10}\n`);

    if (!data || data.length === 0) {
      console.log('⚠️  Nenhum curso encontrado na resposta');
      return;
    }

    console.log('📋 Cursos retornados:\n');
    console.log('═'.repeat(80));

    data.forEach((curso: any, index: number) => {
      console.log(`\n${index + 1}. ${curso.nome || 'Sem nome'}`);
      console.log(`   ID: ${curso.id}`);
      console.log(`   Código: ${curso.codigo || 'N/A'}`);

      // Verificar campos de precificação
      const temValor = curso.valor !== undefined;
      const temValorPromocional =
        curso.valorPromocional !== undefined && curso.valorPromocional !== null;
      const temGratuito = curso.gratuito !== undefined;

      console.log(`\n   💰 Precificação:`);
      console.log(
        `      ✅ Campo 'valor': ${temValor ? '✅ PRESENTE' : '❌ AUSENTE'} - ${curso.valor ?? 'N/A'}`,
      );
      console.log(
        `      ✅ Campo 'valorPromocional': ${temValorPromocional ? '✅ PRESENTE' : '⚠️  NULL/AUSENTE'} - ${curso.valorPromocional ?? 'N/A'}`,
      );
      console.log(
        `      ✅ Campo 'gratuito': ${temGratuito ? '✅ PRESENTE' : '❌ AUSENTE'} - ${curso.gratuito ?? 'N/A'}`,
      );

      // Determinar status do curso
      const isGratuito = curso.gratuito === true || curso.valor === 0;
      const valorFinal = curso.valorPromocional ?? curso.valor ?? 0;

      console.log(`\n   📊 Status:`);
      if (isGratuito) {
        console.log(`      🎁 CURSO GRATUITO`);
      } else {
        console.log(`      💵 CURSO PAGO`);
        console.log(`      💰 Valor: R$ ${Number(curso.valor || 0).toFixed(2)}`);
        if (temValorPromocional) {
          console.log(
            `      🏷️  Valor Promocional: R$ ${Number(curso.valorPromocional).toFixed(2)}`,
          );
          console.log(`      💸 Valor Final: R$ ${Number(valorFinal).toFixed(2)}`);
        } else {
          console.log(`      💸 Valor Final: R$ ${Number(valorFinal).toFixed(2)}`);
        }
      }

      console.log(`\n   ${'─'.repeat(76)}`);
    });

    // Verificar se todos os cursos têm os campos obrigatórios
    const cursosSemValor = data.filter((c: any) => c.valor === undefined);
    const cursosSemGratuito = data.filter((c: any) => c.gratuito === undefined);

    console.log(`\n\n📊 Resumo da Validação:`);
    console.log(
      `   ✅ Cursos com campo 'valor': ${data.length - cursosSemValor.length}/${data.length}`,
    );
    console.log(
      `   ✅ Cursos com campo 'gratuito': ${data.length - cursosSemGratuito.length}/${data.length}`,
    );

    if (cursosSemValor.length > 0 || cursosSemGratuito.length > 0) {
      console.log(`\n   ⚠️  ATENÇÃO: Alguns cursos não possuem todos os campos de precificação!`);
      if (cursosSemValor.length > 0) {
        console.log(
          `      ❌ Cursos sem 'valor': ${cursosSemValor.map((c: any) => c.nome || c.id).join(', ')}`,
        );
      }
      if (cursosSemGratuito.length > 0) {
        console.log(
          `      ❌ Cursos sem 'gratuito': ${cursosSemGratuito.map((c: any) => c.nome || c.id).join(', ')}`,
        );
      }
    } else {
      console.log(`\n   ✅ Todos os cursos possuem os campos de precificação!`);
    }

    // Exibir exemplo de resposta JSON completa do primeiro curso
    console.log(`\n\n📄 Exemplo de resposta completa (primeiro curso):`);
    console.log('═'.repeat(80));
    console.log(JSON.stringify(data[0], null, 2));
  } catch (error: any) {
    console.error('❌ Erro ao testar rota:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Dados:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Executar teste
testCursosPrecificacao()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro no teste:', error);
    process.exit(1);
  });
