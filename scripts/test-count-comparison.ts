/**
 * Script para comparar count da API com count direto
 * Verifica se há algum problema com filtros implícitos
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testCountComparison() {
  console.log('🔍 Comparando count da API com count direto...\n');

  try {
    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await fetch(`${API_URL}/api/v1/usuarios/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documento: '08705420440',
        senha: 'Fili25061995*',
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

    console.log('✅ Login realizado com sucesso\n');

    // 2. Fazer requisição de listagem com diferentes pageSize para forçar todas as páginas
    console.log('2️⃣ Fazendo requisições para contar todas as aulas...');

    let page = 1;
    const pageSize = 100; // Grande para pegar todas de uma vez
    let hasMore = true;
    const todasAulas: any[] = [];

    while (hasMore) {
      const listResponse = await fetch(
        `${API_URL}/api/v1/cursos/aulas?page=${page}&pageSize=${pageSize}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('❌ Erro na listagem:', listResponse.status, errorText);
        break;
      }

      const listData = await listResponse.json();
      const aulas = listData.data || [];
      todasAulas.push(...aulas);
      const pagination = listData.pagination || {};
      const totalPages = pagination.totalPages || 1;
      const total = pagination.total || 0;

      console.log(`   Página ${page}: ${aulas.length} aulas (Total da API: ${total})`);

      if (page >= totalPages || aulas.length === 0) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(
      `   Total de aulas retornadas pela API (soma de todas as páginas): ${todasAulas.length}`,
    );
    console.log(
      `   Total reportado pela API (pagination.total): ${todasAulas[0] ? 'Verificar na primeira resposta' : 'N/A'}`,
    );

    // 3. Verificar padrão nas aulas
    const aulasComTurma = todasAulas.filter((a) => a.turma?.id).length;
    const aulasSemTurma = todasAulas.filter((a) => !a.turma?.id).length;

    console.log(`\n📋 Análise das aulas retornadas:`);
    console.log(`   Aulas com turma: ${aulasComTurma}`);
    console.log(`   Aulas sem turma: ${aulasSemTurma}`);
    console.log(`   Total retornado: ${todasAulas.length}`);

    // 4. Verificar se há padrão
    if (todasAulas.length === 23) {
      console.log(`\n⚠️  PROBLEMA CONFIRMADO: Apenas 23 aulas estão sendo retornadas`);
      console.log(`   Esperado: 46 aulas`);
      console.log(`   Diferença: ${46 - todasAulas.length} aulas não estão sendo retornadas`);

      console.log(`\n🔍 Possíveis causas:`);
      console.log(`   1. Filtro implícito no relacionamento CursosTurmas`);
      console.log(`   2. Filtro de role sendo aplicado incorretamente`);
      console.log(`   3. Problema com o count() que está retornando valor incorreto`);
      console.log(`   4. Aulas sem turma sendo excluídas por algum motivo`);
    }

    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro ao executar teste:', error);
  }
}

testCountComparison();
