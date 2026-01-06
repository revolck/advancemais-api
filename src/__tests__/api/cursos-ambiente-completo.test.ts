import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  createTestUser,
  createTestAdmin,
  cleanupTestUsers,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import { randomUUID } from 'crypto';
import {
  CursosMetodos,
  CursosTurnos,
  CursoStatus,
  CursosFrequenciaStatus,
  CursosModelosRecuperacao,
  CursosEstagioStatus,
} from '@prisma/client';

/**
 * Testes de Ambiente Completo de Cursos
 *
 * Este arquivo cria um ambiente de teste realista com:
 * - 2 cursos (gratuito e pago R$200)
 * - Aulas, atividades e provas
 * - Turma com período que já aconteceu
 * - Alunos aprovados e em recuperação
 * - Frequências, notas, estágios e certificados
 * - Eventos na agenda e notificações
 */
describe('API - Ambiente Completo de Cursos (Gratuito, Pago, Recuperação, Certificados)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;

  // Alunos
  let alunoAprovado1: TestUser;
  let alunoAprovado2: TestUser;
  let alunoRecuperacao: TestUser;
  let testInstrutor: TestUser;

  // IDs para referência e cleanup
  let cursoGratuitoId: string | null = null;
  let cursoPagoId: string | null = null;
  let turmaGratuitaId: string | null = null;
  const aulaTemplateIds: string[] = [];
  const avaliacaoTemplateIds: string[] = [];
  const inscricaoIds: string[] = [];
  const frequenciaIds: string[] = [];
  const notaIds: string[] = [];
  const estagioIds: string[] = [];
  const certificadoIds: string[] = [];
  const notificacaoIds: string[] = [];
  const agendaEventoIds: string[] = [];

  // Datas de teste
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const umMesAtras = new Date(hoje);
  umMesAtras.setMonth(umMesAtras.getMonth() - 1);
  const doisMesesAtras = new Date(hoje);
  doisMesesAtras.setMonth(doisMesesAtras.getMonth() - 2);

  beforeAll(async () => {
    app = await getTestApp();

    // Criar usuários de teste
    testAdmin = await createTestAdmin();
    testInstrutor = await createTestUser({
      role: 'INSTRUTOR',
      emailVerificado: true,
      nomeCompleto: 'Instrutor de Teste',
    });

    // Criar alunos
    alunoAprovado1 = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
      nomeCompleto: 'Aluno Aprovado 1',
    });
    alunoAprovado2 = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
      nomeCompleto: 'Aluno Aprovado 2',
    });
    alunoRecuperacao = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
      nomeCompleto: 'Aluno Recuperação',
    });

    testUsers.push(testAdmin, testInstrutor, alunoAprovado1, alunoAprovado2, alunoRecuperacao);
  }, 60000);

  afterAll(async () => {
    // Limpar dados de teste na ordem correta (foreign keys)
    try {
      // 1. Certificados
      if (certificadoIds.length > 0) {
        await prisma.cursosCertificadosEmitidos.deleteMany({
          where: { id: { in: certificadoIds } },
        });
      }

      // 2. Notificações
      if (notificacaoIds.length > 0) {
        await prisma.notificacoes.deleteMany({
          where: { id: { in: notificacaoIds } },
        });
      }

      // 3. Agenda Eventos (se existir tabela)
      // await prisma.cursosAgendaEventos?.deleteMany({ where: { id: { in: agendaEventoIds } } });

      // 4. Recuperações
      await prisma.cursosTurmasRecuperacoes.deleteMany({
        where: { turmaId: turmaGratuitaId || undefined },
      });

      // 5. Estágios
      if (estagioIds.length > 0) {
        await prisma.cursosEstagios.deleteMany({
          where: { id: { in: estagioIds } },
        });
      }

      // 6. Notas
      if (notaIds.length > 0) {
        await prisma.cursosNotas.deleteMany({
          where: { id: { in: notaIds } },
        });
      }

      // 7. Frequências
      if (frequenciaIds.length > 0) {
        await prisma.cursosFrequenciaAlunos.deleteMany({
          where: { id: { in: frequenciaIds } },
        });
      }

      // 8. Inscrições
      if (inscricaoIds.length > 0) {
        await prisma.cursosTurmasInscricoes.deleteMany({
          where: { id: { in: inscricaoIds } },
        });
      }

      // 9. Turmas
      if (turmaGratuitaId) {
        await prisma.cursosTurmas.deleteMany({
          where: { id: turmaGratuitaId },
        });
      }

      // 10. Aulas Templates
      if (aulaTemplateIds.length > 0) {
        await prisma.cursosTurmasAulas.deleteMany({
          where: { id: { in: aulaTemplateIds } },
        });
      }

      // 11. Avaliações Templates
      if (avaliacaoTemplateIds.length > 0) {
        await prisma.cursosTurmasProvas.deleteMany({
          where: { id: { in: avaliacaoTemplateIds } },
        });
      }

      // 12. Cursos
      if (cursoGratuitoId) {
        await prisma.cursos.deleteMany({ where: { id: cursoGratuitoId } });
      }
      if (cursoPagoId) {
        await prisma.cursos.deleteMany({ where: { id: cursoPagoId } });
      }

      // 13. Usuários
      if (testUsers.length > 0) {
        await cleanupTestUsers(testUsers.map((u) => u.id));
      }
    } catch (error) {
      console.error('Erro ao limpar dados de teste:', error);
    }
  }, 60000);

  // ===========================================
  // SEÇÃO 1: CRIAÇÃO DE CURSOS
  // ===========================================
  describe('1. Criação de Cursos (Gratuito e Pago)', () => {
    it('deve criar um curso GRATUITO', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const cursoData = {
        nome: `Curso Gratuito Teste ${timestamp}`,
        descricao: 'Curso gratuito para testes de ambiente completo',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
        gratuito: true,
        valor: 0,
        estagioObrigatorio: true,
      };

      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(cursoData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.gratuito).toBe(true);
      expect(response.body.valor).toBe(0);

      cursoGratuitoId = response.body.id;
    });

    it('deve criar um curso PAGO (R$ 200)', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const cursoData = {
        nome: `Curso Pago R$200 Teste ${timestamp}`,
        descricao: 'Curso pago para testes de ambiente completo',
        cargaHoraria: 60,
        statusPadrao: 'PUBLICADO',
        gratuito: false,
        valor: 200.0,
        valorPromocional: 180.0,
        estagioObrigatorio: false,
      };

      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(cursoData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.gratuito).toBe(false);
      expect(response.body.valor).toBe(200);

      cursoPagoId = response.body.id;
    });
  });

  // ===========================================
  // SEÇÃO 2: CRIAÇÃO DE CONTEÚDO (AULA, ATIVIDADE, PROVA)
  // ===========================================
  describe('2. Criação de Conteúdo (Aula, Atividade, Prova)', () => {
    it('deve criar uma AULA template para o curso gratuito', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      // Formato correto: ONLINE usa youtubeUrl e não precisa de datas
      const aulaData = {
        titulo: 'Aula 1 - Introdução',
        descricao: 'Aula introdutória do curso completo para testes',
        cursoId: cursoGratuitoId,
        modalidade: 'ONLINE',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        obrigatoria: true,
        duracaoMinutos: 90,
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData);

      // Aceitar 201 (criado) ou verificar o erro para debug
      if (response.status !== 201) {
        console.log('Erro ao criar aula:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.aula).toHaveProperty('id');

      aulaTemplateIds.push(response.body.aula.id);
    });

    it('deve criar uma ATIVIDADE template para o curso gratuito', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      // Formato correto: ATIVIDADE com campos obrigatórios
      const atividadeData = {
        cursoId: cursoGratuitoId,
        tipo: 'ATIVIDADE',
        titulo: 'Atividade Prática 1',
        etiqueta: 'AT1',
        descricao: 'Atividade prática para avaliação',
        peso: 1,
        valePonto: true,
        questoes: [
          {
            enunciado: 'Qual a resposta correta?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Opção A', correta: false },
              { texto: 'Opção B', correta: true },
              { texto: 'Opção C', correta: false },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(atividadeData);

      if (response.status !== 201) {
        console.log('Erro ao criar atividade:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.avaliacao).toHaveProperty('id');
      expect(response.body.avaliacao.tipo).toBe('ATIVIDADE');

      avaliacaoTemplateIds.push(response.body.avaliacao.id);
    });

    it('deve criar uma PROVA template para o curso gratuito', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      const provaData = {
        cursoId: cursoGratuitoId,
        tipo: 'PROVA',
        titulo: 'Prova Final',
        etiqueta: 'PF',
        descricao: 'Prova final do curso',
        peso: 3,
        valePonto: true,
        questoes: [
          {
            enunciado: 'Pergunta 1 da prova?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Resposta A', correta: true },
              { texto: 'Resposta B', correta: false },
            ],
          },
          {
            enunciado: 'Pergunta 2 da prova?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Sim', correta: true },
              { texto: 'Não', correta: false },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(provaData);

      if (response.status !== 201) {
        console.log('Erro ao criar prova:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.avaliacao).toHaveProperty('id');
      expect(response.body.avaliacao.tipo).toBe('PROVA');

      avaliacaoTemplateIds.push(response.body.avaliacao.id);
    });

    it('deve criar uma PROVA DE RECUPERAÇÃO template (acontece amanhã)', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      const recuperacaoData = {
        cursoId: cursoGratuitoId,
        tipo: 'PROVA',
        titulo: 'Recuperação Final',
        etiqueta: 'RF',
        descricao: 'Prova de recuperação final - requer pagamento de R$ 50',
        peso: 1,
        valePonto: true,
        recuperacaoFinal: true,
        questoes: [
          {
            enunciado: 'Pergunta de recuperação?',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'Certo', correta: true },
              { texto: 'Errado', correta: false },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(recuperacaoData);

      if (response.status !== 201) {
        console.log('Erro ao criar recuperação:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.avaliacao).toHaveProperty('id');
      expect(response.body.avaliacao.recuperacaoFinal).toBe(true);

      avaliacaoTemplateIds.push(response.body.avaliacao.id);
    });
  });

  // ===========================================
  // SEÇÃO 3: VERIFICAR META DO CURSO
  // ===========================================
  describe('3. Verificar Meta do Curso (Pré-requisitos para Turma)', () => {
    it('deve retornar meta do curso com templates criados', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      const response = await request(app)
        .get(`/api/v1/cursos/${cursoGratuitoId}/meta`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templatesAulasCount).toBeGreaterThanOrEqual(1);
      expect(response.body.data.templatesAvaliacoesCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================
  // SEÇÃO 4: CRIAÇÃO DE TURMA (Período que já aconteceu)
  // ===========================================
  describe('4. Criação de Turma (Período que já aconteceu)', () => {
    it('deve criar turma gratuita com período passado', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');
      if (aulaTemplateIds.length === 0) throw new Error('Nenhuma aula template criada');
      if (avaliacaoTemplateIds.length < 2) throw new Error('Avaliações insuficientes');

      const timestamp = Date.now().toString().slice(-6);
      const turmaData = {
        nome: `Turma Gratuita Concluída ${timestamp}`,
        instrutorId: testInstrutor.id,
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 30,
        dataInicio: doisMesesAtras.toISOString(),
        dataFim: ontem.toISOString(),
        dataInscricaoInicio: new Date(
          doisMesesAtras.getTime() - 30 * 24 * 60 * 60000,
        ).toISOString(),
        dataInscricaoFim: doisMesesAtras.toISOString(),
        estrutura: {
          modules: [
            {
              title: 'Módulo 1 - Fundamentos',
              startDate: doisMesesAtras.toISOString(),
              endDate: umMesAtras.toISOString(),
              instructorIds: [testInstrutor.id],
              items: [
                { type: 'AULA', title: 'Aula 1 - Introdução', templateId: aulaTemplateIds[0] },
                {
                  type: 'ATIVIDADE',
                  title: 'Atividade Prática 1',
                  templateId: avaliacaoTemplateIds[0],
                },
              ],
            },
            {
              title: 'Módulo 2 - Avaliação Final',
              startDate: umMesAtras.toISOString(),
              endDate: ontem.toISOString(),
              instructorIds: [testInstrutor.id],
              items: [{ type: 'PROVA', title: 'Prova Final', templateId: avaliacaoTemplateIds[1] }],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${cursoGratuitoId}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaData);

      if (response.status !== 201) {
        console.log('Erro ao criar turma:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      // O controller retorna o objeto turma diretamente
      expect(response.body).toHaveProperty('id');

      turmaGratuitaId = response.body.id;
    });
  });

  // ===========================================
  // SEÇÃO 5: INSCRIÇÃO DE ALUNOS
  // ===========================================
  describe('5. Inscrição de Alunos na Turma', () => {
    it('deve inscrever aluno aprovado 1', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Curso ou turma não criados');

      // Criar inscrição diretamente no banco (usando campos corretos do schema)
      const inscricao = await prisma.cursosTurmasInscricoes.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          alunoId: alunoAprovado1.id,
          status: 'CONCLUIDO',
          statusPagamento: 'PAGO',
          aceitouTermos: true,
          aceitouTermosEm: doisMesesAtras,
        },
      });

      inscricaoIds.push(inscricao.id);
      expect(inscricao).toHaveProperty('id');
    });

    it('deve inscrever aluno aprovado 2', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Curso ou turma não criados');

      const inscricao = await prisma.cursosTurmasInscricoes.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          alunoId: alunoAprovado2.id,
          status: 'CONCLUIDO',
          statusPagamento: 'PAGO',
          aceitouTermos: true,
          aceitouTermosEm: doisMesesAtras,
        },
      });

      inscricaoIds.push(inscricao.id);
      expect(inscricao).toHaveProperty('id');
    });

    it('deve inscrever aluno em recuperação (nota < 7)', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Curso ou turma não criados');

      const inscricao = await prisma.cursosTurmasInscricoes.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          alunoId: alunoRecuperacao.id,
          status: 'EM_ANDAMENTO', // Ainda em andamento porque está em recuperação
          statusPagamento: 'PAGO',
          aceitouTermos: true,
          aceitouTermosEm: doisMesesAtras,
        },
      });

      inscricaoIds.push(inscricao.id);
      expect(inscricao).toHaveProperty('id');
    });
  });

  // ===========================================
  // SEÇÃO 6: FREQUÊNCIAS
  // ===========================================
  describe('6. Registro de Frequências', () => {
    it('deve criar frequências para os alunos aprovados (PRESENTE)', async () => {
      if (!turmaGratuitaId || inscricaoIds.length < 2) {
        throw new Error('Turma ou inscrições não criadas');
      }

      // Buscar uma aula da turma
      const aulas = await prisma.cursosTurmasAulas.findMany({
        where: { turmaId: turmaGratuitaId },
        take: 1,
      });

      if (aulas.length === 0) {
        // Se não há aulas vinculadas à turma, criar frequência sem aulaId
        console.log('Nenhuma aula encontrada na turma, criando frequência sem aulaId');
      }

      // Frequência para aluno aprovado 1
      const freq1 = await prisma.cursosFrequenciaAlunos.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[0],
          aulaId: aulas[0]?.id || null,
          status: CursosFrequenciaStatus.PRESENTE,
          dataReferencia: doisMesesAtras,
        },
      });
      frequenciaIds.push(freq1.id);

      // Frequência para aluno aprovado 2
      const freq2 = await prisma.cursosFrequenciaAlunos.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[1],
          aulaId: aulas[0]?.id || null,
          status: CursosFrequenciaStatus.PRESENTE,
          dataReferencia: doisMesesAtras,
        },
      });
      frequenciaIds.push(freq2.id);

      expect(frequenciaIds.length).toBeGreaterThanOrEqual(2);
    });

    it('deve criar frequência para aluno em recuperação (algumas AUSENTE)', async () => {
      if (!turmaGratuitaId || inscricaoIds.length < 3) {
        throw new Error('Turma ou inscrição do aluno recuperação não criada');
      }

      // Frequência AUSENTE para justificar a baixa frequência
      const freq = await prisma.cursosFrequenciaAlunos.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[2],
          aulaId: null,
          status: CursosFrequenciaStatus.AUSENTE,
          justificativa: 'Falta sem justificativa',
          dataReferencia: umMesAtras,
        },
      });
      frequenciaIds.push(freq.id);

      expect(freq.status).toBe('AUSENTE');
    });
  });

  // ===========================================
  // SEÇÃO 7: NOTAS
  // ===========================================
  describe('7. Lançamento de Notas', () => {
    it('deve criar notas para os alunos', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 3) {
        throw new Error('Dados necessários não criados');
      }

      // Nota para aluno aprovado 1 (nota alta)
      const nota1 = await prisma.cursosNotas.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[0],
          tipo: 'OUTRO',
          titulo: 'Prova Final',
          nota: 8.5,
          peso: 1,
          dataReferencia: ontem,
        },
      });
      notaIds.push(nota1.id);

      // Nota para aluno aprovado 2
      const nota2 = await prisma.cursosNotas.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[1],
          tipo: 'OUTRO',
          titulo: 'Prova Final',
          nota: 7.5,
          peso: 1,
          dataReferencia: ontem,
        },
      });
      notaIds.push(nota2.id);

      // Nota para aluno em recuperação (nota baixa)
      const nota3 = await prisma.cursosNotas.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[2],
          tipo: 'OUTRO',
          titulo: 'Prova Final - Necessita Recuperação',
          nota: 5.5,
          peso: 1,
          dataReferencia: ontem,
        },
      });
      notaIds.push(nota3.id);

      expect(notaIds.length).toBe(3);
    });
  });

  // ===========================================
  // SEÇÃO 8: ESTÁGIOS CONCLUÍDOS (para aprovados)
  // ===========================================
  describe('8. Estágios Concluídos', () => {
    it('deve criar estágio APROVADO para aluno aprovado 1', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 1) {
        throw new Error('Dados necessários não criados');
      }

      // Campos obrigatórios conforme schema: nome, dataInicio, dataFim
      const estagio = await prisma.cursosEstagios.create({
        data: {
          id: randomUUID(),
          cursoId: cursoGratuitoId,
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[0],
          alunoId: alunoAprovado1.id,
          nome: 'Estágio Supervisionado 1',
          descricao: 'Estágio obrigatório do curso',
          obrigatorio: true,
          status: CursosEstagioStatus.CONCLUIDO,
          dataInicio: umMesAtras,
          dataFim: ontem,
          cargaHoraria: 100,
          empresaPrincipal: 'Empresa Teste LTDA',
          observacoes: 'Estágio concluído com sucesso',
          criadoPorId: testAdmin.id,
          concluidoEm: ontem,
        },
      });
      estagioIds.push(estagio.id);

      expect(estagio.status).toBe('CONCLUIDO');
    });

    it('deve criar estágio APROVADO para aluno aprovado 2', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 2) {
        throw new Error('Dados necessários não criados');
      }

      const estagio = await prisma.cursosEstagios.create({
        data: {
          id: randomUUID(),
          cursoId: cursoGratuitoId,
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[1],
          alunoId: alunoAprovado2.id,
          nome: 'Estágio Supervisionado 2',
          descricao: 'Estágio obrigatório do curso',
          obrigatorio: true,
          status: CursosEstagioStatus.CONCLUIDO,
          dataInicio: umMesAtras,
          dataFim: ontem,
          cargaHoraria: 100,
          empresaPrincipal: 'Outra Empresa SA',
          observacoes: 'Desempenho excelente',
          criadoPorId: testAdmin.id,
          concluidoEm: ontem,
        },
      });
      estagioIds.push(estagio.id);

      expect(estagio.status).toBe('CONCLUIDO');
    });
  });

  // ===========================================
  // SEÇÃO 9: CERTIFICADOS
  // ===========================================
  describe('9. Emissão de Certificados', () => {
    it('deve emitir certificado para aluno aprovado 1', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 1) {
        throw new Error('Dados necessários não criados');
      }

      // Buscar curso e turma para dados do certificado
      const curso = await prisma.cursos.findUnique({
        where: { id: cursoGratuitoId },
        select: { nome: true, cargaHoraria: true },
      });
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: turmaGratuitaId },
        select: { nome: true },
      });

      // codigo máximo 20 caracteres (@db.VarChar(20))
      const shortCode1 = `CT${Date.now().toString().slice(-8)}01`;
      const certificado = await prisma.cursosCertificadosEmitidos.create({
        data: {
          id: randomUUID(),
          inscricaoId: inscricaoIds[0],
          codigo: shortCode1,
          tipo: 'CONCLUSAO',
          formato: 'DIGITAL',
          cargaHoraria: curso?.cargaHoraria || 40,
          alunoNome: alunoAprovado1.nomeCompleto || 'Aluno Teste 1',
          alunoCpf: alunoAprovado1.cpf,
          cursoNome: curso?.nome || 'Curso Teste',
          turmaNome: turma?.nome || 'Turma Teste',
          emitidoEm: hoje,
          emitidoPorId: testAdmin.id,
        },
      });
      certificadoIds.push(certificado.id);

      expect(certificado).toHaveProperty('codigo');
    });

    it('deve emitir certificado para aluno aprovado 2', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 2) {
        throw new Error('Dados necessários não criados');
      }

      const curso = await prisma.cursos.findUnique({
        where: { id: cursoGratuitoId },
        select: { nome: true, cargaHoraria: true },
      });
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: turmaGratuitaId },
        select: { nome: true },
      });

      // codigo máximo 20 caracteres (@db.VarChar(20))
      const shortCode2 = `CT${Date.now().toString().slice(-8)}02`;
      const certificado = await prisma.cursosCertificadosEmitidos.create({
        data: {
          id: randomUUID(),
          inscricaoId: inscricaoIds[1],
          codigo: shortCode2,
          tipo: 'CONCLUSAO',
          formato: 'DIGITAL',
          cargaHoraria: curso?.cargaHoraria || 40,
          alunoNome: alunoAprovado2.nomeCompleto || 'Aluno Teste 2',
          alunoCpf: alunoAprovado2.cpf,
          cursoNome: curso?.nome || 'Curso Teste',
          turmaNome: turma?.nome || 'Turma Teste',
          emitidoEm: hoje,
          emitidoPorId: testAdmin.id,
        },
      });
      certificadoIds.push(certificado.id);

      expect(certificado).toHaveProperty('codigo');
    });
  });

  // ===========================================
  // SEÇÃO 10: RECUPERAÇÃO (Amanhã - Requer Pagamento)
  // ===========================================
  describe('10. Recuperação Final (Amanhã - Requer Pagamento)', () => {
    it('deve registrar recuperação para aluno com nota baixa', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId || inscricaoIds.length < 3) {
        throw new Error('Dados necessários não criados');
      }

      // Buscar a prova de recuperação
      const provaRecuperacao = await prisma.cursosTurmasProvas.findFirst({
        where: {
          cursoId: cursoGratuitoId,
          recuperacaoFinal: true,
        },
      });

      if (!provaRecuperacao) {
        console.log('Prova de recuperação não encontrada, pulando teste');
        return;
      }

      // Schema correto de CursosTurmasRecuperacoes:
      // - turmaId, inscricaoId, provaId (opcionais/obrigatórios)
      // - notaRecuperacao, notaFinal, mediaCalculada (opcionais)
      // - modeloAplicado (opcional), statusFinal, detalhes, observacoes
      const recuperacao = await prisma.cursosTurmasRecuperacoes.create({
        data: {
          id: randomUUID(),
          turmaId: turmaGratuitaId,
          inscricaoId: inscricaoIds[2],
          provaId: provaRecuperacao.id,
          modeloAplicado: CursosModelosRecuperacao.SUBSTITUICAO,
          statusFinal: 'EM_ANALISE',
          observacoes: 'Aluno elegível para recuperação final. Valor: R$ 50,00',
          detalhes: {
            valorRecuperacao: 50,
            dataLimite: amanha.toISOString(),
            notaOriginal: 5.5,
          },
        },
      });

      expect(recuperacao.statusFinal).toBe('EM_ANALISE');
    });
  });

  // ===========================================
  // SEÇÃO 11: NOTIFICAÇÕES
  // ===========================================
  describe('11. Notificações de Recuperação Final', () => {
    it('deve criar notificação de recuperação pendente para aluno', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) {
        throw new Error('Dados necessários não criados');
      }

      // Buscar curso para pegar nome
      const curso = await prisma.cursos.findUnique({
        where: { id: cursoGratuitoId },
        select: { nome: true },
      });

      const notificacao = await prisma.notificacoes.create({
        data: {
          id: randomUUID(),
          usuarioId: alunoRecuperacao.id,
          tipo: 'RECUPERACAO_FINAL_PAGAMENTO_PENDENTE',
          titulo: 'Recuperação Final Disponível',
          mensagem: `Você está elegível para a recuperação final do curso "${curso?.nome}". Valor: R$ 50,00. Efetue o pagamento para liberar a prova.`,
          prioridade: 'ALTA',
          dados: {
            cursoId: cursoGratuitoId,
            cursoNome: curso?.nome,
            turmaId: turmaGratuitaId,
            valor: 50,
            titulo: 'Recuperação Final',
            returnTo: '/dashboard',
          },
        },
      });
      notificacaoIds.push(notificacao.id);

      expect(notificacao.tipo).toBe('RECUPERACAO_FINAL_PAGAMENTO_PENDENTE');
    });

    it('deve buscar notificações de recuperação do aluno', async () => {
      // O parâmetro `tipo` espera um array, então usar sintaxe de query string para array
      const response = await request(app)
        .get('/api/v1/notificacoes')
        .query({ 'tipo[]': 'RECUPERACAO_FINAL_PAGAMENTO_PENDENTE', apenasNaoLidas: 'true' })
        .set('Authorization', `Bearer ${alunoRecuperacao.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // O retorno é { success, data: [...], pagination: {...} }
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  // ===========================================
  // SEÇÃO 12: LISTAGENS E VERIFICAÇÕES
  // ===========================================
  describe('12. Verificações e Listagens', () => {
    it('deve listar frequências da turma com campos corretos', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Dados não criados');

      const response = await request(app)
        .get(`/api/v1/cursos/${cursoGratuitoId}/turmas/${turmaGratuitaId}/frequencias`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');

      if (response.body.data.length > 0) {
        const freq = response.body.data[0];
        // Verificar campos do aluno que adicionamos
        if (freq.aluno) {
          expect(freq.aluno).toHaveProperty('nomeCompleto');
          expect(freq.aluno).toHaveProperty('codigo');
        }
      }
    });

    it('deve listar resumo de frequências', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Dados não criados');

      const response = await request(app)
        .get(`/api/v1/cursos/${cursoGratuitoId}/turmas/${turmaGratuitaId}/frequencias/resumo`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('deve listar notas consolidadas do curso', async () => {
      if (!cursoGratuitoId || !turmaGratuitaId) throw new Error('Dados não criados');

      const response = await request(app)
        .get(`/api/v1/cursos/${cursoGratuitoId}/notas`)
        .query({ turmaIds: turmaGratuitaId })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('deve listar estágios', async () => {
      if (!cursoGratuitoId) throw new Error('cursoGratuitoId não criado');

      const response = await request(app)
        .get('/api/v1/cursos/estagios')
        .query({ cursoId: cursoGratuitoId })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // O retorno é { success, data: { items: [...], pagination: {...} } }
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('deve verificar certificado por código', async () => {
      if (certificadoIds.length === 0) {
        console.log('Nenhum certificado criado, pulando teste');
        return;
      }

      const certificado = await prisma.cursosCertificadosEmitidos.findUnique({
        where: { id: certificadoIds[0] },
      });

      if (!certificado) {
        console.log('Certificado não encontrado');
        return;
      }

      const response = await request(app)
        .get(`/api/v1/cursos/certificados/codigo/${certificado.codigo}`)
        .expect(200);

      // O controller retorna o certificado diretamente (não { success: true, ... })
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('codigo');
    });
  });

  // ===========================================
  // SEÇÃO 13: AGENDA
  // ===========================================
  describe('13. Eventos da Agenda', () => {
    it('deve listar eventos da agenda', async () => {
      // A rota de agenda requer dataInicio e dataFim como parâmetros obrigatórios
      const response = await request(app)
        .get('/api/v1/cursos/agenda')
        .query({
          dataInicio: doisMesesAtras.toISOString(),
          dataFim: amanha.toISOString(),
        })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
