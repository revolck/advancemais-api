/**
 * Script para testar atualização de turmaId
 * Valida se turmaId está sendo atualizado corretamente
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testAtualizarTurmaId() {
  console.log('🧪 Teste: Atualizar turmaId de Aula\n');

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

    // 2. Buscar uma aula sem turma ou com turma diferente
    console.log('2️⃣ Buscando aula para testar...');
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
    const aulas = listData.data || [];

    if (aulas.length === 0) {
      console.log('⚠️  Nenhuma aula encontrada para testar');
      return;
    }

    // Buscar uma aula para testar (preferir uma sem turma ou com turma diferente)
    const aulaTeste = aulas[0];
    console.log(`✅ Aula selecionada: ${aulaTeste.codigo} - ${aulaTeste.titulo}`);
    console.log(`   Turma atual: ${aulaTeste.turma?.nome || 'N/A'} (${aulaTeste.turmaId || 'null'})\n`);

    // 3. Buscar uma turma para vincular
    console.log('3️⃣ Buscando turma para vincular...');
    // Usar a turma da primeira aula que tem turma, ou buscar outra
    const turmaParaVincular = aulas.find((a: any) => a.turma?.id)?.turma;
    
    if (!turmaParaVincular) {
      console.log('⚠️  Nenhuma turma disponível para vincular');
      return;
    }

    console.log(`✅ Turma selecionada: ${turmaParaVincular.nome} (${turmaParaVincular.id})\n`);

    // 4. Buscar detalhes completos da aula
    console.log('4️⃣ Buscando detalhes completos da aula...');
    const getResponse = await fetch(`${API_URL}/api/v1/cursos/aulas/${aulaTeste.id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('❌ Erro ao buscar detalhes:', getResponse.status, errorText);
      return;
    }

    const aulaDetalhes = await getResponse.json();
    const aula = aulaDetalhes.aula || aulaDetalhes.data;

    console.log('✅ Estado ANTES da atualização:');
    console.log(`   TurmaId: ${aula.turmaId || 'null'}`);
    console.log(`   Turma: ${aula.turma?.nome || 'N/A'}\n`);

    // 5. Preparar payload de atualização
    console.log('5️⃣ Preparando atualização com turmaId...');
    const updatePayload = {
      titulo: aula.titulo, // Manter título
      descricao: aula.descricao || 'Descrição atualizada via teste',
      modalidade: aula.modalidade, // Manter modalidade
      turmaId: turmaParaVincular.id, // ✅ VINCULAR TURMA
      status: aula.status, // Manter status
      obrigatoria: aula.obrigatoria,
      duracaoMinutos: aula.duracaoMinutos || 120,
      gravarAula: aula.gravarAula ?? true,
      dataInicio: aula.dataInicio ? new Date(aula.dataInicio).toISOString().split('T')[0] : undefined,
      dataFim: aula.dataFim ? new Date(aula.dataFim).toISOString().split('T')[0] : undefined,
      horaInicio: aula.horaInicio || undefined,
      horaFim: aula.horaFim || undefined,
    };

    console.log('📤 Payload de atualização:');
    console.log(JSON.stringify(updatePayload, null, 2));
    console.log(`\n✅ turmaId enviado: ${updatePayload.turmaId}\n`);

    // 6. Atualizar aula
    console.log('6️⃣ Atualizando aula...');
    const updateResponse = await fetch(`${API_URL}/api/v1/cursos/aulas/${aula.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Erro ao atualizar:', updateResponse.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error('   Detalhes:', JSON.stringify(errorJson, null, 2));
      } catch {
        console.error('   Erro:', errorText);
      }
      return;
    }

    const updateData = await updateResponse.json();
    const aulaAtualizada = updateData.aula || updateData.data;

    console.log('✅ Aula atualizada!\n');

    // 7. Verificar resultado
    console.log('7️⃣ Verificando resultado...');
    console.log('📊 Estado ANTES da atualização:');
    console.log(`   TurmaId: ${aula.turmaId || 'null'}`);
    console.log(`   Turma: ${aula.turma?.nome || 'N/A'}`);

    console.log('\n📊 Estado DEPOIS da atualização:');
    console.log(`   TurmaId: ${aulaAtualizada.turmaId || 'null'}`);
    console.log(`   Turma: ${aulaAtualizada.turma?.nome || 'N/A'}`);
    console.log(`   Turma ID: ${aulaAtualizada.turma?.id || 'N/A'}`);

    // 8. Validações
    console.log('\n8️⃣ Validações:');
    const validacoes = {
      turmaIdAtualizado: aulaAtualizada.turmaId === turmaParaVincular.id,
      turmaPreenchida: !!aulaAtualizada.turma?.id,
      turmaIdCorreto: aulaAtualizada.turma?.id === turmaParaVincular.id,
    };

    console.log(`   ✅ TurmaId atualizado corretamente: ${validacoes.turmaIdAtualizado ? 'SIM' : 'NÃO'}`);
    if (!validacoes.turmaIdAtualizado) {
      console.log(`      ⚠️  Esperado: ${turmaParaVincular.id}`);
      console.log(`      ⚠️  Recebido: ${aulaAtualizada.turmaId || 'null'}`);
    }
    console.log(`   ✅ Turma preenchida na resposta: ${validacoes.turmaPreenchida ? 'SIM' : 'NÃO'}`);
    console.log(`   ✅ Turma ID correto: ${validacoes.turmaIdCorreto ? 'SIM' : 'NÃO'}`);

    const todasValidas = Object.values(validacoes).every((v) => v);
    if (todasValidas) {
      console.log('\n✅ TODAS AS VALIDAÇÕES PASSARAM!');
      console.log('   A atualização de turmaId funcionou corretamente.');
    } else {
      console.log('\n❌ ALGUMAS VALIDAÇÕES FALHARAM!');
      console.log('   Verifique os detalhes acima.');
    }

    // 9. Buscar novamente para confirmar persistência
    console.log('\n9️⃣ Buscando aula novamente para confirmar persistência...');
    const getResponse2 = await fetch(`${API_URL}/api/v1/cursos/aulas/${aula.id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (getResponse2.ok) {
      const aulaConfirmacao = await getResponse2.json();
      const aulaFinal = aulaConfirmacao.aula || aulaConfirmacao.data;

      console.log('✅ Confirmação final:');
      console.log(`   TurmaId: ${aulaFinal.turmaId || 'null'}`);
      console.log(`   Turma: ${aulaFinal.turma?.nome || 'N/A'}`);
      console.log(`   Turma ID: ${aulaFinal.turma?.id || 'N/A'}`);

      const confirmacaoOk =
        aulaFinal.turmaId === turmaParaVincular.id &&
        aulaFinal.turma?.id === turmaParaVincular.id;

      if (confirmacaoOk) {
        console.log('\n✅ PERSISTÊNCIA CONFIRMADA!');
        console.log('   O turmaId foi salvo corretamente no banco.');
      } else {
        console.log('\n⚠️  PERSISTÊNCIA NÃO CONFIRMADA');
        console.log('   O turmaId pode não ter sido salvo corretamente.');
      }
    }

    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro ao executar teste:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

testAtualizarTurmaId();


