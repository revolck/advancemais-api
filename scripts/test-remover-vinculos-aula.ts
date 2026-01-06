/**
 * Script para testar remoção de vínculos e alteração de modalidade
 * Simula o comportamento do frontend ao remover turma/instrutor e alterar modalidade
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface Aula {
  id: string;
  codigo: string;
  titulo: string;
  modalidade: string;
  turma?: {
    id: string;
    nome: string;
    metodo: string;
  } | null;
  instrutor?: {
    id: string;
    nome: string;
  } | null;
  turmaId?: string | null;
  instrutorId?: string | null;
}

async function testRemoverVinculosAula() {
  console.log('🧪 Teste: Remover Vínculos e Alterar Modalidade de Aula\n');

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

    // 2. Buscar aula presencial com turma e instrutor
    console.log('2️⃣ Buscando aula presencial com turma e instrutor...');
    const listResponse = await fetch(`${API_URL}/api/v1/cursos/aulas?page=1&pageSize=20`, {
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

    // Buscar aula presencial com turma e instrutor
    const aulaPresencial = aulas.find(
      (a: Aula) => a.modalidade === 'PRESENCIAL' && a.turma?.id && a.instrutor?.id,
    );

    if (!aulaPresencial) {
      console.log('⚠️  Nenhuma aula presencial com turma e instrutor encontrada');
      console.log('📋 Aulas disponíveis:');
      aulas.slice(0, 5).forEach((a: Aula) => {
        console.log(`   - ${a.codigo}: ${a.titulo} (${a.modalidade})`);
        console.log(
          `     Turma: ${a.turma?.id ? 'Sim' : 'Não'}, Instrutor: ${a.instrutor?.id ? 'Sim' : 'Não'}`,
        );
      });
      return;
    }

    console.log(`✅ Aula encontrada: ${aulaPresencial.codigo} - ${aulaPresencial.titulo}`);
    console.log(`   Modalidade atual: ${aulaPresencial.modalidade}`);
    console.log(`   Turma: ${aulaPresencial.turma?.nome || 'N/A'} (${aulaPresencial.turma?.id})`);
    console.log(
      `   Instrutor: ${aulaPresencial.instrutor?.nome || 'N/A'} (${aulaPresencial.instrutor?.id})`,
    );
    console.log(`   TurmaId: ${aulaPresencial.turmaId || 'N/A'}`);
    console.log(`   InstrutorId: ${aulaPresencial.instrutorId || 'N/A'}\n`);

    // 3. Buscar detalhes completos da aula
    console.log('3️⃣ Buscando detalhes completos da aula...');
    const getResponse = await fetch(`${API_URL}/api/v1/cursos/aulas/${aulaPresencial.id}`, {
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

    console.log('✅ Detalhes da aula:');
    console.log(`   ID: ${aula.id}`);
    console.log(`   Título: ${aula.titulo}`);
    console.log(`   Descrição: ${aula.descricao || 'N/A'}`);
    console.log(`   Modalidade: ${aula.modalidade}`);
    console.log(`   Status: ${aula.status}`);
    console.log(`   Turma: ${aula.turma?.nome || 'N/A'} (${aula.turma?.id || 'N/A'})`);
    console.log(`   Instrutor: ${aula.instrutor?.nome || 'N/A'} (${aula.instrutor?.id || 'N/A'})`);
    console.log(`   Data Início: ${aula.dataInicio || 'N/A'}`);
    console.log(`   Data Fim: ${aula.dataFim || 'N/A'}`);
    console.log(`   Hora Início: ${aula.horaInicio || 'N/A'}`);
    console.log(`   Hora Fim: ${aula.horaFim || 'N/A'}\n`);

    // 4. Preparar payload de atualização (simulando frontend)
    // Frontend NÃO envia turmaId e instrutorId quando quer remover
    console.log('4️⃣ Preparando atualização (simulando frontend)...');
    const updatePayload = {
      titulo: aula.titulo, // Manter título
      descricao: aula.descricao || 'Aula atualizada via teste', // Manter ou atualizar descrição
      modalidade: 'AO_VIVO', // ✅ Alterar para AO_VIVO
      status: aula.status, // Manter status
      obrigatoria: aula.obrigatoria,
      duracaoMinutos: aula.duracaoMinutos || 120,
      gravarAula: aula.gravarAula ?? true,
      // ❌ NÃO enviar turmaId (frontend remove o vínculo)
      // ❌ NÃO enviar instrutorId (frontend remove o vínculo)
      // ❌ NÃO enviar moduloId (se existir)
      // Manter outros campos se necessário
      dataInicio: aula.dataInicio
        ? new Date(aula.dataInicio).toISOString().split('T')[0]
        : undefined,
      dataFim: aula.dataFim ? new Date(aula.dataFim).toISOString().split('T')[0] : undefined,
      horaInicio: aula.horaInicio || undefined,
      horaFim: aula.horaFim || undefined,
    };

    console.log('📤 Payload de atualização (simulando frontend):');
    console.log(JSON.stringify(updatePayload, null, 2));
    console.log('\n⚠️  Campos NÃO enviados (removidos pelo frontend):');
    console.log('   - turmaId (removido)');
    console.log('   - instrutorId (removido)');
    console.log('   - moduloId (removido)\n');

    // 5. Atualizar aula
    console.log('5️⃣ Atualizando aula...');
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

    console.log('✅ Aula atualizada com sucesso!\n');

    // 6. Verificar resultado
    console.log('6️⃣ Verificando resultado...');
    console.log('📊 Estado ANTES da atualização:');
    console.log(`   Modalidade: ${aula.modalidade}`);
    console.log(`   TurmaId: ${aula.turma?.id || aula.turmaId || 'null'}`);
    console.log(`   InstrutorId: ${aula.instrutor?.id || aula.instrutorId || 'null'}`);
    console.log(`   Turma: ${aula.turma?.nome || 'N/A'}`);

    console.log('\n📊 Estado DEPOIS da atualização:');
    console.log(`   Modalidade: ${aulaAtualizada.modalidade}`);
    console.log(`   TurmaId: ${aulaAtualizada.turma?.id || aulaAtualizada.turmaId || 'null'}`);
    console.log(
      `   InstrutorId: ${aulaAtualizada.instrutor?.id || aulaAtualizada.instrutorId || 'null'}`,
    );
    console.log(`   Turma: ${aulaAtualizada.turma?.nome || 'N/A'}`);

    // 7. Validações
    console.log('\n7️⃣ Validações:');
    const validacoes = {
      modalidadeAlterada: aulaAtualizada.modalidade === 'AO_VIVO',
      turmaRemovida: !aulaAtualizada.turma?.id && !aulaAtualizada.turmaId,
      instrutorRemovido: !aulaAtualizada.instrutor?.id && !aulaAtualizada.instrutorId,
      modalidadeConvertida: aulaAtualizada.modalidade !== 'LIVE', // Não deve retornar LIVE, deve ser AO_VIVO
    };

    console.log(
      `   ✅ Modalidade alterada para AO_VIVO: ${validacoes.modalidadeAlterada ? 'SIM' : 'NÃO'}`,
    );
    if (!validacoes.modalidadeAlterada) {
      console.log(`      ⚠️  Modalidade retornada: ${aulaAtualizada.modalidade}`);
    }
    console.log(
      `   ✅ Modalidade convertida (não retorna LIVE): ${validacoes.modalidadeConvertida ? 'SIM' : 'NÃO'}`,
    );
    console.log(
      `   ✅ Turma removida (turmaId = null): ${validacoes.turmaRemovida ? 'SIM' : 'NÃO'}`,
    );
    console.log(
      `   ✅ Instrutor removido (instrutorId = null): ${validacoes.instrutorRemovido ? 'SIM' : 'NÃO'}`,
    );

    const todasValidas = Object.values(validacoes).every((v) => v);
    if (todasValidas) {
      console.log('\n✅ TODAS AS VALIDAÇÕES PASSARAM!');
      console.log('   A atualização funcionou corretamente.');
    } else {
      console.log('\n❌ ALGUMAS VALIDAÇÕES FALHARAM!');
      console.log('   Verifique os detalhes acima.');
    }

    // 8. Buscar novamente para confirmar persistência
    console.log('\n8️⃣ Buscando aula novamente para confirmar persistência...');
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
      console.log(`   Modalidade: ${aulaFinal.modalidade}`);
      console.log(`   TurmaId: ${aulaFinal.turma?.id || aulaFinal.turmaId || 'null'}`);
      console.log(`   InstrutorId: ${aulaFinal.instrutor?.id || aulaFinal.instrutorId || 'null'}`);

      const confirmacaoOk =
        aulaFinal.modalidade === 'AO_VIVO' && !aulaFinal.turma?.id && !aulaFinal.instrutor?.id;

      if (confirmacaoOk) {
        console.log('\n✅ PERSISTÊNCIA CONFIRMADA!');
        console.log('   As alterações foram salvas corretamente no banco.');
      } else {
        console.log('\n⚠️  PERSISTÊNCIA NÃO CONFIRMADA');
        console.log('   As alterações podem não ter sido salvas corretamente.');
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

testRemoverVinculosAula();
