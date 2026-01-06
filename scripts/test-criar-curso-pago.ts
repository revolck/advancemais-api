/**
 * Script para testar criação e edição de curso pago
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testCriarCursoPago() {
  console.log('🧪 Testando criação de curso pago\n');
  console.log('═'.repeat(80));

  try {
    // 1. Criar curso pago
    console.log('1️⃣ Criando curso PAGO...\n');
    const cursoPago = {
      nome: 'Curso de Teste Pago',
      descricao: 'Este é um curso pago de teste',
      cargaHoraria: 40,
      valor: 299.9,
      valorPromocional: 249.9,
      gratuito: false,
    };

    const createResponse = await fetch(`${API_BASE_URL}/api/v1/cursos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nota: Você precisa adicionar um token de autenticação aqui
        // 'Authorization': 'Bearer SEU_TOKEN_AQUI'
      },
      body: JSON.stringify(cursoPago),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ Erro ao criar curso:', errorData);
      throw new Error(`HTTP ${createResponse.status}: ${JSON.stringify(errorData)}`);
    }

    const cursoCriado = await createResponse.json();
    console.log('✅ Curso criado com sucesso!');
    console.log(`   ID: ${cursoCriado.id}`);
    console.log(`   Nome: ${cursoCriado.nome}`);
    console.log(`   Valor: R$ ${cursoCriado.valor}`);
    console.log(`   Valor Promocional: R$ ${cursoCriado.valorPromocional ?? 'N/A'}`);
    console.log(`   Gratuito: ${cursoCriado.gratuito}`);
    console.log('');

    // Validar campos
    if (cursoCriado.valor !== 299.9) {
      console.error(`❌ ERRO: Valor esperado R$ 299.90, recebido R$ ${cursoCriado.valor}`);
      process.exit(1);
    }
    if (cursoCriado.valorPromocional !== 249.9) {
      console.error(
        `❌ ERRO: Valor promocional esperado R$ 249.90, recebido R$ ${cursoCriado.valorPromocional ?? 'null'}`,
      );
      process.exit(1);
    }
    if (cursoCriado.gratuito !== false) {
      console.error(`❌ ERRO: Campo gratuito esperado false, recebido ${cursoCriado.gratuito}`);
      process.exit(1);
    }

    console.log('✅ Validação dos campos de precificação: OK\n');

    // 2. Atualizar curso (alterar valor)
    console.log('2️⃣ Atualizando curso (alterando valor)...\n');
    const cursoAtualizado = {
      valor: 399.9,
      valorPromocional: 349.9,
    };

    const updateResponse = await fetch(`${API_BASE_URL}/api/v1/cursos/${cursoCriado.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer SEU_TOKEN_AQUI'
      },
      body: JSON.stringify(cursoAtualizado),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('❌ Erro ao atualizar curso:', errorData);
      throw new Error(`HTTP ${updateResponse.status}: ${JSON.stringify(errorData)}`);
    }

    const cursoAtualizadoData = await updateResponse.json();
    console.log('✅ Curso atualizado com sucesso!');
    console.log(`   Valor: R$ ${cursoAtualizadoData.valor}`);
    console.log(`   Valor Promocional: R$ ${cursoAtualizadoData.valorPromocional ?? 'N/A'}`);
    console.log(`   Gratuito: ${cursoAtualizadoData.gratuito}`);
    console.log('');

    // Validar atualização
    if (cursoAtualizadoData.valor !== 399.9) {
      console.error(
        `❌ ERRO: Valor esperado R$ 399.90 após atualização, recebido R$ ${cursoAtualizadoData.valor}`,
      );
      process.exit(1);
    }
    if (cursoAtualizadoData.valorPromocional !== 349.9) {
      console.error(
        `❌ ERRO: Valor promocional esperado R$ 349.90 após atualização, recebido R$ ${cursoAtualizadoData.valorPromocional ?? 'null'}`,
      );
      process.exit(1);
    }

    console.log('✅ Validação da atualização: OK\n');

    // 3. Testar curso gratuito
    console.log('3️⃣ Testando criação de curso GRATUITO...\n');
    const cursoGratuito = {
      nome: 'Curso de Teste Gratuito',
      descricao: 'Este é um curso gratuito de teste',
      cargaHoraria: 20,
      valor: 0,
      gratuito: true,
    };

    const createGratuitoResponse = await fetch(`${API_BASE_URL}/api/v1/cursos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer SEU_TOKEN_AQUI'
      },
      body: JSON.stringify(cursoGratuito),
    });

    if (!createGratuitoResponse.ok) {
      const errorData = await createGratuitoResponse.json();
      console.error('❌ Erro ao criar curso gratuito:', errorData);
      throw new Error(`HTTP ${createGratuitoResponse.status}: ${JSON.stringify(errorData)}`);
    }

    const cursoGratuitoCriado = await createGratuitoResponse.json();
    console.log('✅ Curso gratuito criado com sucesso!');
    console.log(`   Valor: R$ ${cursoGratuitoCriado.valor}`);
    console.log(`   Gratuito: ${cursoGratuitoCriado.gratuito}`);
    console.log('');

    // Validar curso gratuito
    if (cursoGratuitoCriado.valor !== 0) {
      console.error(
        `❌ ERRO: Curso gratuito deve ter valor 0, recebido R$ ${cursoGratuitoCriado.valor}`,
      );
      process.exit(1);
    }
    if (cursoGratuitoCriado.gratuito !== true) {
      console.error(
        `❌ ERRO: Campo gratuito esperado true, recebido ${cursoGratuitoCriado.gratuito}`,
      );
      process.exit(1);
    }

    console.log('✅ Validação do curso gratuito: OK\n');
    console.log('═'.repeat(80));
    console.log('✅ Todos os testes passaram!');
    console.log('\n📋 Resumo:');
    console.log('   ✅ Criação de curso pago funcionando');
    console.log('   ✅ Atualização de valores funcionando');
    console.log('   ✅ Criação de curso gratuito funcionando');
  } catch (error: any) {
    console.error('\n❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Dados:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Executar teste
testCriarCursoPago()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro no teste:', error);
    process.exit(1);
  });
