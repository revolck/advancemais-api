/**
 * Script de automação de testes para cadastro de aulas via API
 *
 * Testa diferentes combinações de:
 * - Modalidades (ONLINE, PRESENCIAL, AO_VIVO, SEMIPRESENCIAL)
 * - Vínculos (sem vínculos, curso+turma, instrutor, curso+turma+instrutor)
 * - Materiais complementares (com e sem)
 */

import axios, { AxiosInstance } from 'axios';
import { prisma } from '../src/config/prisma';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

interface TestConfig {
  modalidade: 'ONLINE' | 'PRESENCIAL' | 'AO_VIVO' | 'SEMIPRESENCIAL';
  titulo: string;
  descricao: string;
  duracaoMinutos: number;
  obrigatoria: boolean;
  cursoId?: string;
  turmaId?: string;
  instrutorId?: string;
  materiais?: string[];
  youtubeUrl?: string;
  dataInicio?: string;
  horaInicio?: string;
  dataFim?: string;
  horaFim?: string;
}

interface TestResult {
  teste: string;
  sucesso: boolean;
  statusCode?: number;
  erro?: string;
  aulaId?: string;
}

const resultados: TestResult[] = [];

let apiClient: AxiosInstance;
let authToken: string = '';

async function fazerLogin(): Promise<boolean> {
  try {
    console.log('🔐 Fazendo login...');

    const response = await axios.post(`${API_URL}/usuarios/login`, {
      documento: '11111111111',
      senha: 'AdminTeste@123',
    });

    if (response.data.token) {
      authToken = response.data.token;
      apiClient = axios.create({
        baseURL: API_URL,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Login realizado com sucesso\n');
      return true;
    }

    console.log('❌ Token não recebido no login');
    return false;
  } catch (error: any) {
    console.error('❌ Erro ao fazer login:', error.response?.data?.message || error.message);
    return false;
  }
}

async function executarTeste(nomeTeste: string, config: TestConfig): Promise<void> {
  console.log(`\n🧪 Executando teste: ${nomeTeste}`);

  try {
    const payload: any = {
      titulo: config.titulo,
      descricao: config.descricao,
      modalidade: config.modalidade,
      duracaoMinutos: config.duracaoMinutos,
      obrigatoria: config.obrigatoria,
      status: 'RASCUNHO',
    };

    // Adicionar campos opcionais
    if (config.youtubeUrl) {
      payload.youtubeUrl = config.youtubeUrl;
    }

    if (config.dataInicio) {
      payload.dataInicio = config.dataInicio;
    }

    if (config.horaInicio) {
      payload.horaInicio = config.horaInicio;
    }

    if (config.dataFim) {
      payload.dataFim = config.dataFim;
    }

    if (config.horaFim) {
      payload.horaFim = config.horaFim;
    }

    if (config.cursoId) {
      payload.cursoId = config.cursoId;
    }

    if (config.turmaId) {
      payload.turmaId = config.turmaId;
    } else if (config.cursoId) {
      // Se tem cursoId mas não turmaId, não enviar turmaId (será null)
      payload.turmaId = null;
    }

    if (config.instrutorId) {
      payload.instrutorId = config.instrutorId;
    }

    if (config.materiais && config.materiais.length > 0) {
      payload.materiais = config.materiais;
    }

    const response = await apiClient.post('/cursos/aulas', payload);

    if (response.status === 201 && response.data.success) {
      const aulaId = response.data.aula?.id;
      resultados.push({
        teste: nomeTeste,
        sucesso: true,
        statusCode: response.status,
        aulaId,
      });
      console.log(`✅ ${nomeTeste} - SUCESSO (ID: ${aulaId})`);
    } else {
      resultados.push({
        teste: nomeTeste,
        sucesso: false,
        statusCode: response.status,
        erro: 'Resposta inesperada',
      });
      console.log(`❌ ${nomeTeste} - FALHOU: Resposta inesperada`);
    }
  } catch (error: any) {
    const statusCode = error.response?.status;
    const errorMessage =
      error.response?.data?.message || error.response?.data?.code || error.message;

    resultados.push({
      teste: nomeTeste,
      sucesso: false,
      statusCode,
      erro: errorMessage,
    });

    console.log(`❌ ${nomeTeste} - FALHOU: ${errorMessage} (${statusCode || 'N/A'})`);
  }
}

async function obterIDsDisponiveis(): Promise<{
  cursoId?: string;
  turmaId?: string;
  instrutorId?: string;
}> {
  console.log('🔍 Buscando IDs disponíveis no banco de dados...\n');

  const ids: {
    cursoId?: string;
    turmaId?: string;
    instrutorId?: string;
  } = {};

  try {
    // Buscar primeiro curso
    const curso = await prisma.cursos.findFirst({
      where: { statusPadrao: 'PUBLICADO' },
      select: { id: true, nome: true },
    });

    if (curso) {
      ids.cursoId = curso.id;
      console.log(`✅ Curso encontrado: ${curso.nome} (${curso.id})`);
    } else {
      console.log('⚠️  Nenhum curso encontrado');
    }

    // Buscar primeira turma (se tiver curso, buscar turma desse curso)
    const turma = await prisma.cursosTurmas.findFirst({
      where: ids.cursoId ? { cursoId: ids.cursoId } : undefined,
      select: { id: true, nome: true, cursoId: true },
    });

    if (turma) {
      ids.turmaId = turma.id;
      ids.cursoId = turma.cursoId; // Garantir que cursoId seja da turma
      console.log(`✅ Turma encontrada: ${turma.nome} (${turma.id})`);
    } else {
      console.log('⚠️  Nenhuma turma encontrada');
    }

    // Buscar primeiro instrutor
    const instrutor = await prisma.usuarios.findFirst({
      where: { role: 'INSTRUTOR', status: 'ATIVO' },
      select: { id: true, nomeCompleto: true },
    });

    if (instrutor) {
      ids.instrutorId = instrutor.id;
      console.log(`✅ Instrutor encontrado: ${instrutor.nomeCompleto} (${instrutor.id})`);
    } else {
      console.log('⚠️  Nenhum instrutor encontrado');
    }

    console.log('');
  } catch (error: any) {
    console.error('❌ Erro ao buscar IDs:', error.message);
  }

  return ids;
}

async function main() {
  console.log('🚀 Iniciando testes automatizados de cadastro de aulas via API\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  // Obter IDs disponíveis
  const ids = await obterIDsDisponiveis();

  // Fazer login
  const loginSucesso = await fazerLogin();
  if (!loginSucesso) {
    console.error('❌ Não foi possível fazer login. Abortando testes.');
    await prisma.$disconnect();
    return;
  }

  // ============================================
  // FASE 1: Sem vínculos (sem curso, turma, instrutor, materiais)
  // ============================================
  console.log('\n📌 FASE 1: Testes sem vínculos\n');

  await executarTeste('1.1 - ONLINE sem vínculos', {
    modalidade: 'ONLINE',
    titulo: 'Aula Teste ONLINE Sem Vínculos',
    descricao: 'Descrição da aula ONLINE sem vínculos para teste automatizado',
    duracaoMinutos: 60,
    obrigatoria: true,
    youtubeUrl: 'https://www.youtube.com/watch?v=test123',
  });

  await executarTeste('1.2 - PRESENCIAL sem vínculos', {
    modalidade: 'PRESENCIAL',
    titulo: 'Aula Teste PRESENCIAL Sem Vínculos',
    descricao: 'Descrição da aula PRESENCIAL sem vínculos para teste automatizado',
    duracaoMinutos: 90,
    obrigatoria: false,
    dataInicio: '2026-03-01',
    horaInicio: '09:00',
  });

  await executarTeste('1.3 - AO_VIVO sem vínculos', {
    modalidade: 'AO_VIVO',
    titulo: 'Aula Teste AO_VIVO Sem Vínculos',
    descricao: 'Descrição da aula AO_VIVO sem vínculos para teste automatizado',
    duracaoMinutos: 120,
    obrigatoria: true,
    dataInicio: '2026-03-15',
    horaInicio: '14:00',
  });

  await executarTeste('1.4 - SEMIPRESENCIAL sem vínculos', {
    modalidade: 'SEMIPRESENCIAL',
    titulo: 'Aula Teste SEMIPRESENCIAL Sem Vínculos',
    descricao: 'Descrição da aula SEMIPRESENCIAL sem vínculos para teste automatizado',
    duracaoMinutos: 90,
    obrigatoria: false,
    youtubeUrl: 'https://www.youtube.com/watch?v=test456',
  });

  // ============================================
  // FASE 2: Com curso e turma (sem instrutor, sem materiais)
  // ============================================
  console.log('\n📌 FASE 2: Testes com curso e turma\n');

  if (!ids.cursoId || !ids.turmaId) {
    console.log('⚠️  Pulando FASE 2: curso ou turma não encontrados\n');
  } else {
    const cursoId = ids.cursoId;
    const turmaId = ids.turmaId;

    await executarTeste('2.1 - ONLINE com curso e turma', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Com Curso e Turma',
      descricao: 'Descrição da aula ONLINE com curso e turma para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test789',
      cursoId,
      turmaId,
    });

    await executarTeste('2.2 - PRESENCIAL com curso e turma', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Com Curso e Turma',
      descricao: 'Descrição da aula PRESENCIAL com curso e turma para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-02',
      horaInicio: '09:00',
      cursoId,
      turmaId,
    });

    await executarTeste('2.3 - AO_VIVO com curso e turma', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Com Curso e Turma',
      descricao: 'Descrição da aula AO_VIVO com curso e turma para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-16',
      horaInicio: '14:00',
      cursoId,
      turmaId,
    });

    await executarTeste('2.4 - SEMIPRESENCIAL com curso e turma', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Com Curso e Turma',
      descricao: 'Descrição da aula SEMIPRESENCIAL com curso e turma para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test101',
      cursoId,
      turmaId,
    });
  }

  // ============================================
  // FASE 3: Com instrutor (sem curso/turma, sem materiais)
  // ============================================
  console.log('\n📌 FASE 3: Testes com instrutor\n');

  if (!ids.instrutorId) {
    console.log('⚠️  Pulando FASE 3: instrutor não encontrado\n');
  } else {
    const instrutorId = ids.instrutorId;

    await executarTeste('3.1 - ONLINE com instrutor', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Com Instrutor',
      descricao: 'Descrição da aula ONLINE com instrutor para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test202',
      instrutorId,
    });

    await executarTeste('3.2 - PRESENCIAL com instrutor', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Com Instrutor',
      descricao: 'Descrição da aula PRESENCIAL com instrutor para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-03',
      horaInicio: '09:00',
      instrutorId,
    });

    await executarTeste('3.3 - AO_VIVO com instrutor', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Com Instrutor',
      descricao: 'Descrição da aula AO_VIVO com instrutor para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-17',
      horaInicio: '14:00',
      instrutorId,
    });

    await executarTeste('3.4 - SEMIPRESENCIAL com instrutor', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Com Instrutor',
      descricao: 'Descrição da aula SEMIPRESENCIAL com instrutor para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test303',
      instrutorId,
    });
  }

  // ============================================
  // FASE 4: Com curso, turma e instrutor (sem materiais)
  // ============================================
  console.log('\n📌 FASE 4: Testes com curso, turma e instrutor\n');

  if (!ids.cursoId || !ids.turmaId || !ids.instrutorId) {
    console.log('⚠️  Pulando FASE 4: curso, turma ou instrutor não encontrados\n');
  } else {
    const cursoId = ids.cursoId;
    const turmaId = ids.turmaId;
    const instrutorId = ids.instrutorId;

    await executarTeste('4.1 - ONLINE com curso, turma e instrutor', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Completa',
      descricao: 'Descrição da aula ONLINE completa para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test404',
      cursoId,
      turmaId,
      instrutorId,
    });

    await executarTeste('4.2 - PRESENCIAL com curso, turma e instrutor', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Completa',
      descricao: 'Descrição da aula PRESENCIAL completa para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-04',
      horaInicio: '09:00',
      cursoId,
      turmaId,
      instrutorId,
    });

    await executarTeste('4.3 - AO_VIVO com curso, turma e instrutor', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Completa',
      descricao: 'Descrição da aula AO_VIVO completa para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-18',
      horaInicio: '14:00',
      cursoId,
      turmaId,
      instrutorId,
    });

    await executarTeste('4.4 - SEMIPRESENCIAL com curso, turma e instrutor', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Completa',
      descricao: 'Descrição da aula SEMIPRESENCIAL completa para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test505',
      cursoId,
      turmaId,
      instrutorId,
    });
  }

  // ============================================
  // FASE 5: Com materiais (sem outros vínculos)
  // ============================================
  console.log('\n📌 FASE 5: Testes com materiais\n');

  await executarTeste('5.1 - ONLINE com materiais', {
    modalidade: 'ONLINE',
    titulo: 'Aula Teste ONLINE Com Materiais',
    descricao: 'Descrição da aula ONLINE com materiais para teste automatizado',
    duracaoMinutos: 60,
    obrigatoria: true,
    youtubeUrl: 'https://www.youtube.com/watch?v=test606',
    materiais: ['https://example.com/material1.pdf', 'https://example.com/material2.pdf'],
  });

  await executarTeste('5.2 - PRESENCIAL com materiais', {
    modalidade: 'PRESENCIAL',
    titulo: 'Aula Teste PRESENCIAL Com Materiais',
    descricao: 'Descrição da aula PRESENCIAL com materiais para teste automatizado',
    duracaoMinutos: 90,
    obrigatoria: false,
    dataInicio: '2026-03-05',
    horaInicio: '09:00',
    materiais: ['https://example.com/material3.pdf'],
  });

  await executarTeste('5.3 - AO_VIVO com materiais', {
    modalidade: 'AO_VIVO',
    titulo: 'Aula Teste AO_VIVO Com Materiais',
    descricao: 'Descrição da aula AO_VIVO com materiais para teste automatizado',
    duracaoMinutos: 120,
    obrigatoria: true,
    dataInicio: '2026-03-19',
    horaInicio: '14:00',
    materiais: ['https://example.com/material4.pdf', 'https://example.com/material5.pdf'],
  });

  await executarTeste('5.4 - SEMIPRESENCIAL com materiais', {
    modalidade: 'SEMIPRESENCIAL',
    titulo: 'Aula Teste SEMIPRESENCIAL Com Materiais',
    descricao: 'Descrição da aula SEMIPRESENCIAL com materiais para teste automatizado',
    duracaoMinutos: 90,
    obrigatoria: false,
    youtubeUrl: 'https://www.youtube.com/watch?v=test707',
    materiais: ['https://example.com/material6.pdf'],
  });

  // ============================================
  // FASE 6: Com materiais + curso + turma + instrutor
  // ============================================
  console.log('\n📌 FASE 6: Testes completos com materiais\n');

  if (!ids.cursoId || !ids.turmaId || !ids.instrutorId) {
    console.log('⚠️  Pulando FASE 6: curso, turma ou instrutor não encontrados\n');
  } else {
    const cursoId = ids.cursoId;
    const turmaId = ids.turmaId;
    const instrutorId = ids.instrutorId;

    await executarTeste('6.1 - ONLINE completo com materiais', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Completa Com Materiais',
      descricao: 'Descrição da aula ONLINE completa com materiais para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test808',
      cursoId,
      turmaId,
      instrutorId,
      materiais: ['https://example.com/material7.pdf', 'https://example.com/material8.pdf'],
    });

    await executarTeste('6.2 - PRESENCIAL completo com materiais', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Completa Com Materiais',
      descricao: 'Descrição da aula PRESENCIAL completa com materiais para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-06',
      horaInicio: '09:00',
      cursoId,
      turmaId,
      instrutorId,
      materiais: ['https://example.com/material9.pdf'],
    });

    await executarTeste('6.3 - AO_VIVO completo com materiais', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Completa Com Materiais',
      descricao: 'Descrição da aula AO_VIVO completa com materiais para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-20',
      horaInicio: '14:00',
      cursoId,
      turmaId,
      instrutorId,
      materiais: ['https://example.com/material10.pdf', 'https://example.com/material11.pdf'],
    });

    await executarTeste('6.4 - SEMIPRESENCIAL completo com materiais', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Completa Com Materiais',
      descricao: 'Descrição da aula SEMIPRESENCIAL completa com materiais para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test909',
      cursoId,
      turmaId,
      instrutorId,
      materiais: ['https://example.com/material12.pdf'],
    });
  }

  // ============================================
  // RESUMO
  // ============================================
  console.log('\n\n📊 RESUMO DOS TESTES\n');
  console.log('='.repeat(80));

  const sucessos = resultados.filter((r) => r.sucesso).length;
  const falhas = resultados.filter((r) => !r.sucesso).length;

  console.log(`Total: ${resultados.length} testes`);
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}\n`);

  resultados.forEach((resultado) => {
    const status = resultado.sucesso ? '✅' : '❌';
    console.log(`${status} ${resultado.teste}`);
    if (resultado.aulaId) {
      console.log(`   ID: ${resultado.aulaId}`);
    }
    if (!resultado.sucesso) {
      console.log(`   Status: ${resultado.statusCode || 'N/A'}`);
      if (resultado.erro) {
        console.log(`   Erro: ${resultado.erro}`);
      }
    }
  });

  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  prisma.$disconnect();
  process.exit(1);
});
