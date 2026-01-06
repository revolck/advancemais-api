/**
 * Script de teste para criação de aulas de todos os tipos
 * Testa: PRESENCIAL, ONLINE, AO_VIVO, SEMIPRESENCIAL
 * Verifica criação de Google Meet para AO_VIVO e SEMIPRESENCIAL
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || ''; // Token JWT do usuário admin

// Helper para fazer requisições
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return {
    status: response.status,
    data,
  };
}

// Buscar uma turma para usar nos testes
async function getTurma() {
  console.log('🔍 Buscando turma disponível...');
  const result = await apiRequest('/api/v1/cursos/turmas?page=1&pageSize=1');

  if (result.status === 200 && result.data.data && result.data.data.length > 0) {
    return result.data.data[0];
  }

  throw new Error('Nenhuma turma encontrada. Crie uma turma primeiro.');
}

// Buscar um instrutor
async function getInstrutor() {
  console.log('🔍 Buscando instrutor disponível...');
  const result = await apiRequest('/api/v1/usuarios?role=INSTRUTOR&page=1&pageSize=1');

  if (result.status === 200 && result.data.data && result.data.data.length > 0) {
    return result.data.data[0];
  }

  throw new Error('Nenhum instrutor encontrado.');
}

// Teste 1: Aula PRESENCIAL (apenas dataInicio)
async function testPresencialUnicoDia() {
  console.log('\n📚 TESTE 1: Aula PRESENCIAL (único dia)');
  const turma = await getTurma();

  const payload = {
    titulo: 'Teste Aula Presencial - Único Dia',
    descricao: 'Aula presencial que acontece apenas em um dia',
    modalidade: 'PRESENCIAL',
    obrigatoria: true,
    duracaoMinutos: 120,
    status: 'RASCUNHO',
    turmaId: turma.id,
    sala: 'Sala 101',
    dataInicio: '2025-12-20', // Apenas dataInicio
    horaInicio: '14:00',
    horaFim: '16:00',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula PRESENCIAL criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   Data Início: ${result.data.aula.dataInicio}`);
    console.log(`   Data Fim: ${result.data.aula.dataFim || 'Não informada (único dia)'}`);
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula PRESENCIAL:', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Teste 2: Aula PRESENCIAL (período de X a Y)
async function testPresencialPeriodo() {
  console.log('\n📚 TESTE 2: Aula PRESENCIAL (período de X a Y)');
  const turma = await getTurma();

  const payload = {
    titulo: 'Teste Aula Presencial - Período',
    descricao: 'Aula presencial que acontece de 20/12 a 22/12',
    modalidade: 'PRESENCIAL',
    obrigatoria: true,
    duracaoMinutos: 120,
    status: 'RASCUNHO',
    turmaId: turma.id,
    sala: 'Sala 102',
    dataInicio: '2025-12-20',
    dataFim: '2025-12-22', // Período de X a Y
    horaInicio: '14:00',
    horaFim: '16:00',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula PRESENCIAL (período) criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   Data Início: ${result.data.aula.dataInicio}`);
    console.log(`   Data Fim: ${result.data.aula.dataFim}`);
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula PRESENCIAL (período):', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Teste 3: Aula ONLINE
async function testOnline() {
  console.log('\n📚 TESTE 3: Aula ONLINE');
  const turma = await getTurma();

  const payload = {
    titulo: 'Teste Aula Online',
    descricao: 'Aula online com vídeo do YouTube',
    modalidade: 'ONLINE',
    obrigatoria: true,
    duracaoMinutos: 60,
    status: 'RASCUNHO',
    turmaId: turma.id,
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula ONLINE criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   YouTube URL: ${result.data.aula.youtubeUrl}`);
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula ONLINE:', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Teste 4: Aula AO_VIVO (deve criar Google Meet)
async function testAoVivo() {
  console.log('\n📚 TESTE 4: Aula AO_VIVO (com Google Meet)');
  const turma = await getTurma();
  const instrutor = await getInstrutor();

  const payload = {
    titulo: 'Teste Aula Ao Vivo',
    descricao: 'Aula ao vivo com Google Meet',
    modalidade: 'AO_VIVO',
    tipoLink: 'MEET',
    obrigatoria: true,
    duracaoMinutos: 90,
    status: 'RASCUNHO',
    turmaId: turma.id,
    instrutorId: instrutor.id,
    dataInicio: '2025-12-25', // Data futura
    horaInicio: '19:00',
    horaFim: '20:30',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula AO_VIVO criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   Data Início: ${result.data.aula.dataInicio}`);
    console.log(`   Meet URL: ${result.data.aula.meetUrl || 'Não criado'}`);
    if (result.data.aula.meetUrl) {
      console.log('   ✅ Google Meet criado com sucesso!');
    } else {
      console.log('   ⚠️ Google Meet não foi criado (pode ser erro ou não configurado)');
    }
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula AO_VIVO:', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Teste 5: Aula SEMIPRESENCIAL (com YouTube)
async function testSemipresencialYoutube() {
  console.log('\n📚 TESTE 5: Aula SEMIPRESENCIAL (com YouTube)');
  const turma = await getTurma();

  const payload = {
    titulo: 'Teste Aula Semipresencial - YouTube',
    descricao: 'Aula semipresencial com vídeo do YouTube',
    modalidade: 'SEMIPRESENCIAL',
    tipoLink: 'YOUTUBE',
    obrigatoria: true,
    duracaoMinutos: 60,
    status: 'RASCUNHO',
    turmaId: turma.id,
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula SEMIPRESENCIAL (YouTube) criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   YouTube URL: ${result.data.aula.youtubeUrl}`);
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula SEMIPRESENCIAL (YouTube):', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Teste 6: Aula SEMIPRESENCIAL (com Meet)
async function testSemipresencialMeet() {
  console.log('\n📚 TESTE 6: Aula SEMIPRESENCIAL (com Google Meet)');
  const turma = await getTurma();
  const instrutor = await getInstrutor();

  const payload = {
    titulo: 'Teste Aula Semipresencial - Meet',
    descricao: 'Aula semipresencial com Google Meet',
    modalidade: 'SEMIPRESENCIAL',
    tipoLink: 'MEET',
    obrigatoria: true,
    duracaoMinutos: 90,
    status: 'RASCUNHO',
    turmaId: turma.id,
    instrutorId: instrutor.id,
    dataInicio: '2025-12-26', // Data futura
    horaInicio: '19:00',
    horaFim: '20:30',
  };

  const result = await apiRequest('/api/v1/cursos/aulas', 'POST', payload);

  if (result.status === 201) {
    console.log('✅ Aula SEMIPRESENCIAL (Meet) criada com sucesso!');
    console.log(`   ID: ${result.data.aula.id}`);
    console.log(`   Data Início: ${result.data.aula.dataInicio}`);
    console.log(`   Meet URL: ${result.data.aula.meetUrl || 'Não criado'}`);
    if (result.data.aula.meetUrl) {
      console.log('   ✅ Google Meet criado com sucesso!');
    } else {
      console.log('   ⚠️ Google Meet não foi criado (pode ser erro ou não configurado)');
    }
    return result.data.aula;
  } else {
    console.error('❌ Erro ao criar aula SEMIPRESENCIAL (Meet):', result.data);
    throw new Error(`Status ${result.status}: ${JSON.stringify(result.data)}`);
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando testes de criação de aulas...\n');
  console.log(`📍 API URL: ${BASE_URL}`);
  console.log(`🔑 Token: ${API_TOKEN ? 'Configurado' : 'Não configurado (pode falhar)'}\n`);

  const results = {
    success: [],
    failed: [],
  };

  try {
    // Teste 1: PRESENCIAL (único dia)
    try {
      const aula1 = await testPresencialUnicoDia();
      results.success.push({ test: 'PRESENCIAL (único dia)', aula: aula1 });
    } catch (error) {
      results.failed.push({ test: 'PRESENCIAL (único dia)', error: error.message });
    }

    // Teste 2: PRESENCIAL (período)
    try {
      const aula2 = await testPresencialPeriodo();
      results.success.push({ test: 'PRESENCIAL (período)', aula: aula2 });
    } catch (error) {
      results.failed.push({ test: 'PRESENCIAL (período)', error: error.message });
    }

    // Teste 3: ONLINE
    try {
      const aula3 = await testOnline();
      results.success.push({ test: 'ONLINE', aula: aula3 });
    } catch (error) {
      results.failed.push({ test: 'ONLINE', error: error.message });
    }

    // Teste 4: AO_VIVO
    try {
      const aula4 = await testAoVivo();
      results.success.push({ test: 'AO_VIVO', aula: aula4 });
    } catch (error) {
      results.failed.push({ test: 'AO_VIVO', error: error.message });
    }

    // Teste 5: SEMIPRESENCIAL (YouTube)
    try {
      const aula5 = await testSemipresencialYoutube();
      results.success.push({ test: 'SEMIPRESENCIAL (YouTube)', aula: aula5 });
    } catch (error) {
      results.failed.push({ test: 'SEMIPRESENCIAL (YouTube)', error: error.message });
    }

    // Teste 6: SEMIPRESENCIAL (Meet)
    try {
      const aula6 = await testSemipresencialMeet();
      results.success.push({ test: 'SEMIPRESENCIAL (Meet)', aula: aula6 });
    } catch (error) {
      results.failed.push({ test: 'SEMIPRESENCIAL (Meet)', error: error.message });
    }
  } catch (error) {
    console.error('\n❌ Erro fatal durante os testes:', error);
  }

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  console.log(`✅ Sucessos: ${results.success.length}`);
  results.success.forEach((r) => {
    console.log(`   - ${r.test}`);
  });
  console.log(`\n❌ Falhas: ${results.failed.length}`);
  results.failed.forEach((r) => {
    console.log(`   - ${r.test}: ${r.error}`);
  });
  console.log('='.repeat(60));

  return results;
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests };
