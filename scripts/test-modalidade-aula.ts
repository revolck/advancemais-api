/**
 * Script para testar modalidade de aula vs modalidade da turma
 * Valida se a conversão LIVE → AO_VIVO está sendo feita corretamente
 */

import 'dotenv/config';

/** Credenciais só por variável de ambiente (nunca no código) */
function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} para rodar este script.`);
  return valor;
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testModalidadeAula() {
  console.log('🔍 Testando modalidade de aula vs modalidade da turma...\n');

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

    console.log('✅ Login realizado com sucesso\n');

    // 2. Buscar aulas com turma vinculada
    console.log('2️⃣ Buscando aulas com turma vinculada...');
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
    const aulasComTurma = (listData.data || []).filter((a: any) => a.turma?.id);

    console.log(`✅ Encontradas ${aulasComTurma.length} aulas com turma vinculada\n`);

    if (aulasComTurma.length === 0) {
      console.log('⚠️  Nenhuma aula com turma encontrada para testar');
      return;
    }

    // 3. Verificar inconsistências
    console.log('3️⃣ Verificando inconsistências de modalidade...\n');
    const inconsistencias: any[] = [];

    aulasComTurma.forEach((aula: any) => {
      const aulaModalidade = aula.modalidade;
      const turmaMetodo = aula.turma?.metodo;

      if (!turmaMetodo) return;

      // Mapear método da turma para modalidade esperada
      const modalidadeEsperada = turmaMetodo === 'LIVE' ? 'AO_VIVO' : turmaMetodo;

      if (aulaModalidade !== modalidadeEsperada) {
        inconsistencias.push({
          aulaId: aula.id,
          aulaCodigo: aula.codigo,
          aulaTitulo: aula.titulo,
          aulaModalidade,
          turmaMetodo,
          modalidadeEsperada,
        });
      }
    });

    if (inconsistencias.length > 0) {
      console.log(`❌ Encontradas ${inconsistencias.length} inconsistências:\n`);
      inconsistencias.forEach((inc, index) => {
        console.log(`${index + 1}. Aula ${inc.aulaCodigo} (${inc.aulaTitulo})`);
        console.log(`   Modalidade atual: ${inc.aulaModalidade}`);
        console.log(`   Método da turma: ${inc.turmaMetodo}`);
        console.log(`   Modalidade esperada: ${inc.modalidadeEsperada}\n`);
      });
    } else {
      console.log('✅ Nenhuma inconsistência encontrada!\n');
    }

    // 4. Testar busca de aula específica
    if (aulasComTurma.length > 0) {
      const aulaTeste = aulasComTurma[0];
      console.log(`4️⃣ Testando busca de aula específica: ${aulaTeste.codigo}...`);

      const getResponse = await fetch(`${API_URL}/api/v1/cursos/aulas/${aulaTeste.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (getResponse.ok) {
        const aulaData = await getResponse.json();
        const aula = aulaData.aula || aulaData.data;

        console.log(`✅ Aula encontrada:`);
        console.log(`   Modalidade: ${aula.modalidade}`);
        console.log(`   Turma método: ${aula.turma?.metodo || 'N/A'}`);
        console.log(
          `   Modalidade esperada: ${aula.turma?.metodo === 'LIVE' ? 'AO_VIVO' : aula.turma?.metodo || 'N/A'}\n`,
        );

        // 5. Testar atualização (se houver inconsistência)
        if (inconsistencias.length > 0 && inconsistencias[0].aulaId === aulaTeste.id) {
          console.log(`5️⃣ Testando atualização de aula com modalidade incorreta...`);

          const updateResponse = await fetch(`${API_URL}/api/v1/cursos/aulas/${aulaTeste.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              titulo: aula.titulo, // Manter título
              descricao: aula.descricao,
              modalidade: inconsistencias[0].modalidadeEsperada, // Corrigir modalidade
              turmaId: aula.turma?.id,
            }),
          });

          if (updateResponse.ok) {
            const updateData = await updateResponse.json();
            console.log(`✅ Aula atualizada:`);
            console.log(
              `   Nova modalidade: ${updateData.aula?.modalidade || updateData.data?.modalidade}`,
            );
          } else {
            const errorText = await updateResponse.text();
            console.error(`❌ Erro ao atualizar:`, updateResponse.status, errorText);
          }
        }
      }
    }

    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro ao executar teste:', error);
  }
}

testModalidadeAula();
