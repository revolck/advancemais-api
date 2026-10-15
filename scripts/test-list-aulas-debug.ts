/**
 * Script para testar listagem de aulas e verificar contagem
 * Faz login como admin e testa a API
 */

import 'dotenv/config';

/** Credenciais só por variável de ambiente (nunca no código) */
function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} para rodar este script.`);
  return valor;
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testListAulas() {
  console.log('🔍 Testando listagem de aulas...\n');

  try {
    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await fetch(`${API_URL}/api/v1/usuarios/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documento: exigirEnv('E2E_ADMIN_DOCUMENTO'),
        senha: exigirEnv('E2E_ADMIN_SENHA'),
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Erro no login:', loginResponse.status, errorText);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token || loginData.data?.token;

    if (!token) {
      console.error('❌ Token não encontrado na resposta:', loginData);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log(`   Role: ${loginData.user?.role || loginData.data?.user?.role || 'N/A'}`);
    console.log(`   User ID: ${loginData.user?.id || loginData.data?.user?.id || 'N/A'}\n`);

    // 2. Fazer requisição de listagem
    console.log('2️⃣ Fazendo requisição de listagem de aulas...');
    const listResponse = await fetch(`${API_URL}/api/v1/cursos/aulas?page=1&pageSize=10`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('❌ Erro na listagem:', listResponse.status, errorText);
      return;
    }

    const listData = await listResponse.json();

    console.log('✅ Listagem realizada com sucesso\n');
    console.log('📊 Resultado:');
    console.log(`   Total de aulas: ${listData.pagination?.total || 'N/A'}`);
    console.log(`   Total de páginas: ${listData.pagination?.totalPages || 'N/A'}`);
    console.log(`   Página atual: ${listData.pagination?.page || 'N/A'}`);
    console.log(`   Tamanho da página: ${listData.pagination?.pageSize || 'N/A'}`);
    console.log(`   Aulas retornadas: ${listData.data?.length || 0}\n`);

    // 3. Verificar se o total está correto
    const total = listData.pagination?.total;
    const expectedTotal = 46;

    if (total === expectedTotal) {
      console.log(`✅ Total correto: ${total} (esperado: ${expectedTotal})`);
    } else {
      console.log(`❌ Total incorreto: ${total} (esperado: ${expectedTotal})`);
      console.log(`   Diferença: ${expectedTotal - (total || 0)} aulas não estão sendo contadas\n`);
    }

    // 4. Mostrar algumas aulas retornadas
    if (listData.data && listData.data.length > 0) {
      console.log('📋 Primeiras 5 aulas retornadas:');
      listData.data.slice(0, 5).forEach((aula: any, index: number) => {
        console.log(
          `   ${index + 1}. ${aula.codigo || 'N/A'} - ${aula.titulo || 'N/A'} (Turma: ${aula.turma?.nome || 'SEM TURMA'})`,
        );
      });
      console.log('');
    }

    // 5. Verificar se há padrão nas aulas não retornadas
    console.log('🔍 Análise:');
    if (total && total < expectedTotal) {
      const missing = expectedTotal - total;
      console.log(`   ⚠️  ${missing} aulas não estão sendo contadas`);
      console.log(`   Possíveis causas:`);
      console.log(`   - Filtro de role sendo aplicado incorretamente`);
      console.log(`   - Filtro implícito no relacionamento CursosTurmas`);
      console.log(`   - Aulas sem turma sendo excluídas`);
      console.log(`   - Outro filtro sendo aplicado`);
    }

    console.log('\n✅ Teste concluído!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. Verificar logs do servidor (LIST_AULAS_DEBUG e LIST_AULAS_RESULT)');
    console.log('   2. Verificar o where clause aplicado');
    console.log('   3. Verificar se há filtros implícitos');
  } catch (error) {
    console.error('❌ Erro ao executar teste:', error);
  }
}

testListAulas();
