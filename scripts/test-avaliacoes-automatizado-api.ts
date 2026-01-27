/**
 * Script automatizado para testar rotas de avaliações/provas
 * Testa criação, atualização, listagem e validações
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const LOGIN_PASSWORD = 'AdminTeste@123';

interface TestConfig {
  nome: string;
  tipo: 'PROVA' | 'ATIVIDADE';
  tipoAtividade?: 'QUESTOES' | 'PERGUNTA_RESPOSTA';
  payload: any;
  esperaSucesso: boolean;
  descricao?: string;
}

let token: string | null = null;
const avaliacoesCriadas: string[] = [];

/**
 * Fazer login e obter token
 */
async function fazerLogin(): Promise<boolean> {
  try {
    console.log('🔐 Fazendo login...');

    const response = await axios.post(`${API_BASE_URL}/api/v1/usuarios/login`, {
      documento: '11111111111', // CPF do admin teste
      senha: LOGIN_PASSWORD,
    });

    if (response.data.token) {
      token = response.data.token;
      console.log('✅ Login realizado com sucesso\n');
      return true;
    }

    console.error('❌ Login falhou: token não recebido');
    return false;
  } catch (error: any) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Executar um teste
 */
async function executarTeste(config: TestConfig): Promise<void> {
  const { nome, payload, esperaSucesso, descricao } = config;
  console.log(`\n📝 Teste: ${nome}`);
  if (descricao) {
    console.log(`   ${descricao}`);
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/cursos/avaliacoes`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (esperaSucesso) {
      if (response.status === 201 && response.data.success) {
        const avaliacaoId = response.data.avaliacao?.id;
        if (avaliacaoId) {
          avaliacoesCriadas.push(avaliacaoId);
        }
        console.log(`   ✅ SUCESSO - Status: ${response.status}`);
        console.log(`   📋 ID: ${avaliacaoId || 'N/A'}`);
        console.log(`   📊 Tipo: ${response.data.avaliacao?.tipo || 'N/A'}`);
        if (response.data.avaliacao?.tipoAtividade) {
          console.log(`   📚 Tipo Atividade: ${response.data.avaliacao.tipoAtividade}`);
        }
        console.log(`   📝 Título: ${response.data.avaliacao?.titulo || 'N/A'}`);
        console.log(`   📍 Status: ${response.data.avaliacao?.status || 'N/A'}`);
      } else {
        console.log(`   ❌ FALHOU - Esperava sucesso mas recebeu:`);
        console.log(`      Status: ${response.status}`);
        console.log(`      Resposta:`, JSON.stringify(response.data, null, 2));
      }
    } else {
      // Esperava erro
      if (response.status >= 400) {
        console.log(`   ✅ ERRO ESPERADO - Status: ${response.status}`);
        console.log(`   📋 Código: ${response.data.code || 'N/A'}`);
        console.log(`   💬 Mensagem: ${response.data.message || 'N/A'}`);
        if (response.data.issues) {
          console.log(`   ⚠️  Issues:`, JSON.stringify(response.data.issues, null, 2));
        }
      } else {
        console.log(`   ❌ FALHOU - Esperava erro mas recebeu sucesso`);
        console.log(`      Status: ${response.status}`);
      }
    }
  } catch (error: any) {
    if (esperaSucesso) {
      console.log(`   ❌ ERRO INESPERADO:`);
      console.log(`      Status: ${error.response?.status || 'N/A'}`);
      console.log(`      Mensagem: ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.issues) {
        console.log(`      Issues:`, JSON.stringify(error.response.data.issues, null, 2));
      }
    } else {
      // Erro esperado
      console.log(`   ✅ ERRO ESPERADO:`);
      console.log(`      Status: ${error.response?.status || 'N/A'}`);
      console.log(`      Código: ${error.response?.data?.code || 'N/A'}`);
      console.log(`      Mensagem: ${error.response?.data?.message || error.message}`);
    }
  }
}

/**
 * Obter IDs disponíveis para testes via API
 */
async function obterIDsDisponiveis(): Promise<{
  cursoId?: string;
  turmaId?: string;
  instrutorId?: string;
}> {
  try {
    // Buscar cursos
    const cursosResponse = await axios.get(
      `${API_BASE_URL}/api/v1/cursos?page=1&pageSize=1&statusPadrao=PUBLICADO`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const cursoId = cursosResponse.data?.data?.[0]?.id;

    // Buscar turmas
    const turmasResponse = await axios.get(
      `${API_BASE_URL}/api/v1/cursos/turmas?page=1&pageSize=1&status=ATIVA`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const turmaId = turmasResponse.data?.data?.[0]?.id;

    // Buscar instrutores (via endpoint de avaliações)
    const instrutoresResponse = await axios.get(
      `${API_BASE_URL}/api/v1/cursos/avaliacoes/instrutores`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const instrutorId = instrutoresResponse.data?.data?.[0]?.id;

    return {
      cursoId,
      turmaId,
      instrutorId,
    };
  } catch (error: any) {
    console.warn('⚠️  Erro ao obter IDs via API:', error.response?.data?.message || error.message);
    return {};
  }
}

/**
 * Obter datas para testes
 */
function obterDatas(): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(hoje.getDate() + 1); // Amanhã

  const dataFim = new Date(dataInicio);
  dataFim.setDate(dataInicio.getDate() + 7); // 7 dias depois

  return {
    dataInicio: dataInicio.toISOString().split('T')[0],
    dataFim: dataFim.toISOString().split('T')[0],
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando testes automatizados de avaliações/provas\n');
  console.log('='.repeat(60));

  // 1. Login
  const loginOk = await fazerLogin();
  if (!loginOk) {
    console.error('❌ Não foi possível fazer login. Abortando.');
    process.exit(1);
  }

  // 2. Obter IDs disponíveis
  console.log('🔍 Buscando IDs disponíveis...');
  const ids = await obterIDsDisponiveis();
  console.log(`   Curso: ${ids.cursoId || 'N/A'}`);
  console.log(`   Turma: ${ids.turmaId || 'N/A'}`);
  console.log(`   Instrutor: ${ids.instrutorId || 'N/A'}\n`);

  // 3. Obter datas
  const datas = obterDatas();
  console.log(`📅 Período de teste:`);
  console.log(`   Início: ${datas.dataInicio}`);
  console.log(`   Fim: ${datas.dataFim}\n`);

  // 4. Definir testes
  const testes: TestConfig[] = [
    // ========== PROVAS ==========
    {
      nome: 'Prova 01 - Básica (sem vínculos)',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Básica - Teste Automatizado',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        recuperacaoFinal: false,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '10:00',
        questoes: [
          {
            enunciado: 'Qual é a capital do Brasil?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'São Paulo', correta: false },
              { texto: 'Rio de Janeiro', correta: false },
              { texto: 'Brasília', correta: true },
              { texto: 'Belo Horizonte', correta: false },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Prova básica sem vincular curso/turma/instrutor',
    },
    {
      nome: 'Prova 02 - Com questões múltiplas',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova com Múltiplas Questões',
        modalidade: 'PRESENCIAL',
        obrigatoria: true,
        valePonto: true,
        peso: 8,
        recuperacaoFinal: false,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '14:00',
        horaTermino: '16:00',
        questoes: [
          {
            enunciado: 'Questão 1: Qual é 2+2?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: '3', correta: false },
              { texto: '4', correta: true },
            ],
          },
          {
            enunciado: 'Questão 2: Qual é a cor do céu?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Vermelho', correta: false },
              { texto: 'Azul', correta: true },
              { texto: 'Verde', correta: false },
            ],
          },
          {
            enunciado: 'Questão 3: Quantos planetas existem?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: '7', correta: false },
              { texto: '8', correta: true },
              { texto: '9', correta: false },
              { texto: '10', correta: false },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Prova com 3 questões de múltipla escolha',
    },
    {
      nome: 'Prova 03 - Com vínculos (curso/turma/instrutor)',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Vinculada',
        cursoId: ids.cursoId,
        turmaId: ids.turmaId,
        instrutorId: ids.instrutorId,
        modalidade: 'AO_VIVO',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        recuperacaoFinal: false,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '19:00',
        horaTermino: '21:00',
        questoes: [
          {
            enunciado: 'Questão vinculada',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Opção A', correta: false },
              { texto: 'Opção B', correta: true },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Prova vinculada a curso, turma e instrutor',
    },
    {
      nome: 'Prova 04 - Recuperação Final',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova de Recuperação Final',
        modalidade: 'SEMIPRESENCIAL',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        recuperacaoFinal: true,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '09:00',
        horaTermino: '11:00',
        questoes: [
          {
            enunciado: 'Questão de recuperação',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: false },
              { texto: 'B', correta: true },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Prova de recuperação final (deve valer ponto)',
    },

    // ========== ATIVIDADES - QUESTOES ==========
    {
      nome: 'Atividade 01 - QUESTOES (sem vínculos)',
      tipo: 'ATIVIDADE',
      tipoAtividade: 'QUESTOES',
      payload: {
        tipo: 'ATIVIDADE',
        tipoAtividade: 'QUESTOES',
        titulo: 'Atividade com Questões',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: false,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '23:59',
        questoes: [
          {
            enunciado: 'Questão da atividade',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Alternativa A', correta: false },
              { texto: 'Alternativa B', correta: true },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Atividade tipo QUESTOES sem vincular curso/turma',
    },
    {
      nome: 'Atividade 02 - QUESTOES (com vínculos)',
      tipo: 'ATIVIDADE',
      tipoAtividade: 'QUESTOES',
      payload: {
        tipo: 'ATIVIDADE',
        tipoAtividade: 'QUESTOES',
        titulo: 'Atividade Vinculada',
        cursoId: ids.cursoId,
        turmaId: ids.turmaId,
        instrutorId: ids.instrutorId,
        modalidade: 'PRESENCIAL',
        obrigatoria: false,
        valePonto: true,
        peso: 5,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '10:00',
        horaTermino: '12:00',
        questoes: [
          {
            enunciado: 'Questão 1',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: false },
              { texto: 'B', correta: true },
            ],
          },
          {
            enunciado: 'Questão 2',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'C', correta: true },
              { texto: 'D', correta: false },
            ],
          },
        ],
      },
      esperaSucesso: true,
      descricao: 'Atividade QUESTOES vinculada e valendo ponto',
    },

    // ========== ATIVIDADES - PERGUNTA_RESPOSTA ==========
    {
      nome: 'Atividade 03 - PERGUNTA_RESPOSTA (sem vínculos)',
      tipo: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      payload: {
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: 'Atividade Pergunta e Resposta',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: false,
        descricao:
          'Descreva em detalhes como funciona o processo de desenvolvimento de software ágil.',
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '23:59',
      },
      esperaSucesso: true,
      descricao: 'Atividade tipo PERGUNTA_RESPOSTA sem vincular curso/turma',
    },
    {
      nome: 'Atividade 04 - PERGUNTA_RESPOSTA (com vínculos)',
      tipo: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      payload: {
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: 'Atividade Pergunta/Resposta Vinculada',
        cursoId: ids.cursoId,
        turmaId: ids.turmaId,
        instrutorId: ids.instrutorId,
        modalidade: 'AO_VIVO',
        obrigatoria: true,
        valePonto: true,
        peso: 7,
        descricao: 'Explique o conceito de herança em programação orientada a objetos.',
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '14:00',
        horaTermino: '16:00',
      },
      esperaSucesso: true,
      descricao: 'Atividade PERGUNTA_RESPOSTA vinculada e valendo ponto',
    },

    // ========== VALIDAÇÕES - ERROS ESPERADOS ==========
    {
      nome: 'Validação 01 - Prova sem questões',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Sem Questões',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '10:00',
        // Sem questões
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: PROVA requer pelo menos 1 questão',
    },
    {
      nome: 'Validação 02 - valePonto=true sem peso',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Sem Peso',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        // peso ausente
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '10:00',
        questoes: [
          {
            enunciado: 'Questão',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: false },
              { texto: 'B', correta: true },
            ],
          },
        ],
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: valePonto=true requer peso',
    },
    {
      nome: 'Validação 03 - Questão sem alternativa correta',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Questão Inválida',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '10:00',
        questoes: [
          {
            enunciado: 'Questão sem correta',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: false },
              { texto: 'B', correta: false },
            ],
          },
        ],
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: múltipla escolha requer exatamente 1 correta',
    },
    {
      nome: 'Validação 04 - Questão com mais de 4 alternativas',
      tipo: 'PROVA',
      payload: {
        tipo: 'PROVA',
        titulo: 'Prova Muitas Alternativas',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 10,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '10:00',
        questoes: [
          {
            enunciado: 'Questão com 5 alternativas',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: false },
              { texto: 'B', correta: false },
              { texto: 'C', correta: false },
              { texto: 'D', correta: false },
              { texto: 'E', correta: true },
            ],
          },
        ],
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: múltipla escolha permite no máximo 4 alternativas',
    },
    {
      nome: 'Validação 05 - ATIVIDADE sem tipoAtividade',
      tipo: 'ATIVIDADE',
      payload: {
        tipo: 'ATIVIDADE',
        // tipoAtividade ausente
        titulo: 'Atividade Sem Tipo',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: false,
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '23:59',
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: ATIVIDADE requer tipoAtividade',
    },
    {
      nome: 'Validação 06 - PERGUNTA_RESPOSTA sem descricao',
      tipo: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      payload: {
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: 'Atividade Sem Descrição',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: false,
        // descricao ausente
        dataInicio: datas.dataInicio,
        dataFim: datas.dataFim,
        horaInicio: '08:00',
        horaTermino: '23:59',
      },
      esperaSucesso: false,
      descricao: 'Deve falhar: PERGUNTA_RESPOSTA requer descricao (pergunta)',
    },
  ];

  // 5. Executar testes
  console.log(`\n🧪 Executando ${testes.length} testes...\n`);
  console.log('='.repeat(60));

  let sucessos = 0;
  let falhas = 0;

  for (const teste of testes) {
    await executarTeste(teste);
    if (teste.esperaSucesso) {
      sucessos++;
    } else {
      falhas++;
    }
    // Pequeno delay entre testes
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 6. Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  console.log(`✅ Sucessos esperados: ${sucessos}`);
  console.log(`❌ Erros esperados: ${falhas}`);
  console.log(`📋 Total de avaliações criadas: ${avaliacoesCriadas.length}`);
  console.log(`🆔 IDs criados: ${avaliacoesCriadas.join(', ') || 'Nenhum'}`);

  // 7. Manter dados criados (não limpar)
  if (avaliacoesCriadas.length > 0) {
    console.log('\n💾 Avaliações criadas serão mantidas no banco de dados');
    console.log(`📋 Total: ${avaliacoesCriadas.length} avaliações`);
  }

  console.log('\n✅ Testes concluídos!\n');
}

// Executar
main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
