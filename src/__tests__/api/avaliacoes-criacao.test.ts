import request from 'supertest';
import { CursosAvaliacaoTipo, CursosAtividadeTipo, CursosAulaStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser } from '../helpers/auth-helper';

describe('API - Criação de Avaliações (Provas e Atividades)', () => {
  let app: any;
  let adminToken: string;
  let adminId: string;
  let instrutorToken: string;
  let instrutorId: string;
  let cursoId: string;
  let turmaId: string;

  beforeAll(async () => {
    app = await getTestApp();

    // Criar usuário admin
    const admin = await createTestUser({
      email: `admin-aval-${Date.now()}@test.com`,
      password: 'Test123!@#',
      emailVerificado: true,
      role: 'ADMIN',
    });
    adminId = admin.id;

    // Login admin
    const adminLogin = await request(app)
      .post('/api/v1/usuarios/login')
      .send({ documento: admin.cpf, senha: admin.password })
      .expect(200);
    adminToken = adminLogin.body.token;

    // Criar usuário instrutor
    const instrutor = await createTestUser({
      email: `instrutor-aval-${Date.now()}@test.com`,
      password: 'Test123!@#',
      emailVerificado: true,
      role: 'INSTRUTOR',
    });
    instrutorId = instrutor.id;

    // Login instrutor
    const instrutorLogin = await request(app)
      .post('/api/v1/usuarios/login')
      .send({ documento: instrutor.cpf, senha: instrutor.password })
      .expect(200);
    instrutorToken = instrutorLogin.body.token;

    // Criar curso de teste
    const timestamp = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        codigo: `CRS${timestamp}`,
        nome: 'Curso Teste Avaliações',
        statusPadrao: 'PUBLICADO',
        cargaHoraria: 120,
        valor: 0,
        gratuito: true,
        estagioObrigatorio: false,
      },
    });
    cursoId = curso.id;

    // Criar turma de teste
    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId: curso.id,
        codigo: `TRM${timestamp}`,
        nome: 'Turma Teste Avaliações',
        metodo: 'PRESENCIAL',
        instrutorId: instrutorId,
        vagasTotais: 30,
        vagasDisponiveis: 30,
        dataInicio: new Date('2026-02-01'),
        dataFim: new Date('2026-06-30'),
        status: 'INSCRICOES_ABERTAS',
      },
    });
    turmaId = turma.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (cursoId) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { cursoId },
      });
      await prisma.cursosTurmas.deleteMany({
        where: { cursoId },
      });
      await prisma.cursos
        .delete({
          where: { id: cursoId },
        })
        .catch(() => {});
    }
    if (adminId || instrutorId) {
      await prisma.usuarios
        .deleteMany({
          where: { id: { in: [adminId, instrutorId].filter(Boolean) } },
        })
        .catch(() => {});
    }
  });

  describe('1. PROVA - Vinculada com uma turma', () => {
    it('deve criar prova vinculada a uma turma', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          turmaId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Final - Turma X',
          peso: 10,
          valePonto: true,
          obrigatoria: true,
          dataInicio: '2026-03-15',
          dataFim: '2026-03-15',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Qual é a capital do Brasil?',
              tipo: 'MULTIPLA_ESCOLHA',
              obrigatoria: true,
              alternativas: [
                { texto: 'São Paulo', correta: false },
                { texto: 'Brasília', correta: true },
                { texto: 'Rio de Janeiro', correta: false },
                { texto: 'Salvador', correta: false },
              ],
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.avaliacao.turmaId).toBe(turmaId);
      expect(response.body.avaliacao.modalidade).toBe('PRESENCIAL'); // Pegou do metodo da turma
      expect(response.body.avaliacao.status).toBe(CursosAulaStatus.RASCUNHO); // Padrão para turma vinculada
      expect(response.body.avaliacao.instrutorId).toBe(instrutorId); // Pegou da turma
    });
  });

  describe('2. PROVA - Desvinculada com turma', () => {
    it('deve criar prova sem vínculo com turma', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Global do Curso',
          peso: 8,
          valePonto: true,
          modalidade: 'ONLINE',
          dataInicio: '2026-04-10',
          dataFim: '2026-04-10',
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Pergunta teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.avaliacao.turmaId).toBeNull();
      expect(response.body.avaliacao.modalidade).toBe('ONLINE');
    });
  });

  describe('3. PROVA - Com instrutor específico', () => {
    it('deve criar prova com instrutor específico', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          instrutorId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova com Instrutor',
          peso: 10,
          modalidade: 'ONLINE',
          dataInicio: '2026-05-01',
          dataFim: '2026-05-01',
          horaInicio: '09:00',
          horaTermino: '11:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.instrutorId).toBe(instrutorId);
      expect(response.body.avaliacao.instrutor).toBeDefined();
      expect(response.body.avaliacao.instrutor.id).toBe(instrutorId);
    });
  });

  describe('4. PROVA - Sem instrutor', () => {
    it('deve criar prova sem instrutor', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Sem Instrutor',
          peso: 7,
          modalidade: 'ONLINE',
          dataInicio: '2026-06-01',
          dataFim: '2026-06-01',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste sem instrutor',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'Sim', correta: true },
                { texto: 'Não', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.instrutorId).toBeNull();
      expect(response.body.avaliacao.instrutor).toBeNull();
    });
  });

  describe('5. PROVA - Valendo nota', () => {
    it('deve criar prova valendo nota', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Valendo Nota',
          peso: 10,
          valePonto: true,
          modalidade: 'ONLINE',
          dataInicio: '2026-07-01',
          dataFim: '2026-07-01',
          horaInicio: '08:00',
          horaTermino: '10:00',
          questoes: [
            {
              enunciado: 'Teste vale ponto',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.valePonto).toBe(true);
      expect(response.body.avaliacao.peso).toBe(10);
    });
  });

  describe('6. PROVA - Não valendo nota', () => {
    it('deve criar prova não valendo nota', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Simulado (não vale nota)',
          peso: 5,
          valePonto: false,
          modalidade: 'ONLINE',
          dataInicio: '2026-08-01',
          dataFim: '2026-08-01',
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Teste simulado',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.valePonto).toBe(false);
    });
  });

  describe('7. PROVA - Recuperação final', () => {
    it('deve criar prova de recuperação final', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          turmaId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova de Recuperação Final',
          peso: 10,
          valePonto: true, // Obrigatório quando recuperacaoFinal = true
          recuperacaoFinal: true,
          modalidade: 'PRESENCIAL',
          dataInicio: '2026-12-15',
          dataFim: '2026-12-15',
          horaInicio: '14:00',
          horaTermino: '17:00',
          questoes: [
            {
              enunciado: 'Questão recuperação',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.recuperacaoFinal).toBe(true);
      expect(response.body.avaliacao.valePonto).toBe(true);
    });

    it('deve rejeitar recuperação final que não vale ponto', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Recuperação Inválida',
          peso: 10,
          valePonto: false, // Inválido!
          recuperacaoFinal: true,
          modalidade: 'ONLINE',
          dataInicio: '2026-12-20',
          dataFim: '2026-12-20',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('8. PROVA - Não recuperação final', () => {
    it('deve criar prova normal (não recuperação)', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Regular',
          peso: 8,
          recuperacaoFinal: false,
          modalidade: 'ONLINE',
          dataInicio: '2026-09-01',
          dataFim: '2026-09-01',
          horaInicio: '13:00',
          horaTermino: '15:00',
          questoes: [
            {
              enunciado: 'Teste regular',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.recuperacaoFinal).toBe(false);
    });
  });

  describe('9. ATIVIDADE - Tipo QUESTOES (com questões)', () => {
    it('deve criar atividade do tipo QUESTOES', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          turmaId,
          tipo: CursosAvaliacaoTipo.ATIVIDADE,
          tipoAtividade: CursosAtividadeTipo.QUESTOES,
          titulo: 'Atividade de Revisão',
          peso: 5,
          valePonto: true,
          obrigatoria: true,
          modalidade: 'ONLINE',
          dataInicio: '2026-10-01',
          dataFim: '2026-10-05',
          horaInicio: '08:00',
          horaTermino: '23:59',
          questoes: [
            {
              enunciado: 'Questão 1 da atividade',
              tipo: 'MULTIPLA_ESCOLHA',
              obrigatoria: true,
              alternativas: [
                { texto: 'Opção A', correta: true },
                { texto: 'Opção B', correta: false },
                { texto: 'Opção C', correta: false },
              ],
            },
            {
              enunciado: 'Questão 2 da atividade',
              tipo: 'MULTIPLA_ESCOLHA',
              obrigatoria: true,
              alternativas: [
                { texto: 'Sim', correta: false },
                { texto: 'Não', correta: true },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.tipo).toBe(CursosAvaliacaoTipo.ATIVIDADE);
      expect(response.body.avaliacao.tipoAtividade).toBe(CursosAtividadeTipo.QUESTOES);
      expect(response.body.avaliacao.questoes).toHaveLength(2);
    });

    it('deve rejeitar atividade QUESTOES sem questões', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.ATIVIDADE,
          tipoAtividade: CursosAtividadeTipo.QUESTOES,
          titulo: 'Atividade Sem Questões',
          peso: 5,
          modalidade: 'ONLINE',
          dataInicio: '2026-10-10',
          dataFim: '2026-10-15',
          horaInicio: '08:00',
          horaTermino: '23:59',
          questoes: [], // Vazio - inválido!
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('10. ATIVIDADE - Tipo PERGUNTA_RESPOSTA', () => {
    it('deve criar atividade do tipo PERGUNTA_RESPOSTA', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          turmaId,
          tipo: CursosAvaliacaoTipo.ATIVIDADE,
          tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
          titulo: 'Atividade Dissertativa',
          descricao:
            'Descreva em suas palavras o que você aprendeu sobre programação orientada a objetos.',
          peso: 4,
          valePonto: true,
          obrigatoria: true,
          modalidade: 'ONLINE',
          dataInicio: '2026-11-01',
          dataFim: '2026-11-07',
          horaInicio: '00:00',
          horaTermino: '23:59',
        })
        .expect(201);

      expect(response.body.avaliacao.tipo).toBe(CursosAvaliacaoTipo.ATIVIDADE);
      expect(response.body.avaliacao.tipoAtividade).toBe(CursosAtividadeTipo.PERGUNTA_RESPOSTA);
      expect(response.body.avaliacao.descricao).toContain('programação');
      expect(response.body.avaliacao.questoes).toHaveLength(0); // Não tem questões estruturadas
    });

    it('deve rejeitar PERGUNTA_RESPOSTA sem descrição', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.ATIVIDADE,
          tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
          titulo: 'Atividade Sem Pergunta',
          peso: 3,
          modalidade: 'ONLINE',
          dataInicio: '2026-11-10',
          dataFim: '2026-11-15',
          horaInicio: '08:00',
          horaTermino: '23:59',
          // descricao ausente - inválido!
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('deve rejeitar PERGUNTA_RESPOSTA com descricao > 500 caracteres', async () => {
      const descricaoLonga = 'a'.repeat(501);

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.ATIVIDADE,
          tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
          titulo: 'Atividade Pergunta Longa',
          descricao: descricaoLonga,
          peso: 3,
          modalidade: 'ONLINE',
          dataInicio: '2026-11-20',
          dataFim: '2026-11-25',
          horaInicio: '08:00',
          horaTermino: '23:59',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Validações de Data e Horário', () => {
    it('deve rejeitar data de início no passado', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Data Passada',
          peso: 10,
          modalidade: 'ONLINE',
          dataInicio: '2020-01-01', // Passado
          dataFim: '2020-01-01',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('deve rejeitar dataFim < dataInicio', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Datas Invertidas',
          peso: 10,
          modalidade: 'ONLINE',
          dataInicio: '2026-12-31',
          dataFim: '2026-12-01', // Antes do início
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('deve rejeitar horaTermino <= horaInicio no mesmo dia', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Horário Inválido',
          peso: 10,
          modalidade: 'ONLINE',
          dataInicio: '2026-12-15',
          dataFim: '2026-12-15',
          horaInicio: '16:00',
          horaTermino: '14:00', // Antes do início
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Validações de Peso da Nota', () => {
    it('deve rejeitar peso > 10', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Peso Inválido',
          peso: 15, // Máximo é 10
          modalidade: 'ONLINE',
          dataInicio: '2026-12-20',
          dataFim: '2026-12-20',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('deve aceitar peso decimal válido (ex: 7.5)', async () => {
      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova Peso Decimal',
          peso: 7.5,
          modalidade: 'ONLINE',
          dataInicio: '2027-01-15',
          dataFim: '2027-01-15',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        })
        .expect(201);

      expect(response.body.avaliacao.peso).toBe(7.5);
    });
  });

  describe('Validações de Questões', () => {
    it('deve rejeitar prova com mais de 10 questões', async () => {
      const questoes = Array.from({ length: 11 }, (_, i) => ({
        enunciado: `Questão ${i + 1}`,
        tipo: 'MULTIPLA_ESCOLHA',
        alternativas: [
          { texto: 'A', correta: true },
          { texto: 'B', correta: false },
        ],
      }));

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          tipo: CursosAvaliacaoTipo.PROVA,
          titulo: 'Prova com Muitas Questões',
          peso: 10,
          modalidade: 'ONLINE',
          dataInicio: '2027-02-01',
          dataFim: '2027-02-01',
          horaInicio: '14:00',
          horaTermino: '17:00',
          questoes,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
