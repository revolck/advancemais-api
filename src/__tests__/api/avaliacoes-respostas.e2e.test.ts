import request from 'supertest';
import type { Express } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';

jest.setTimeout(60000);

describe('API - Avaliações Respostas (E2E)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let admin: TestUser;
  let aluno: TestUser;
  let alunoSemResposta: TestUser;

  let cursoId: string;
  let turmaId: string;
  let inscricaoId: string;
  let inscricaoSemRespostaId: string;

  let provaId: string;
  let provaQuestaoId: string;
  let provaAlternativaCorretaId: string;
  let provaAlternativaErradaId: string;
  let provaEnvioId: string;

  let atividadeDiscursivaId: string;
  let atividadeQuestaoId: string;
  let atividadeEnvioId: string;
  let atividadeSemNotaId: string;
  let atividadeSemNotaQuestaoId: string;
  let atividadeSemNotaEnvioId: string;
  const provaEnvioIp = '177.12.10.10';
  const atividadeEnvioIp = '177.12.20.20';

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    aluno = await createTestUser({ role: 'ALUNO_CANDIDATO', emailVerificado: true });
    alunoSemResposta = await createTestUser({ role: 'ALUNO_CANDIDATO', emailVerificado: true });
    testUsers.push(admin, aluno, alunoSemResposta);

    const suffix = Date.now().toString().slice(-6);

    const curso = await prisma.cursos.create({
      data: {
        codigo: `AVR${suffix}`,
        nome: `Curso Respostas ${suffix}`,
        cargaHoraria: 40,
        valor: new Prisma.Decimal(100),
        gratuito: false,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TR${suffix}`,
        nome: `Turma Respostas ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: aluno.id,
        codigo: `INSC-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId = inscricao.id;

    const inscricaoSemResposta = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: alunoSemResposta.id,
        codigo: `INSC2-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoSemRespostaId = inscricaoSemResposta.id;

    const prova = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId,
        turmaId,
        tipo: 'PROVA',
        titulo: `Prova ${suffix}`,
        etiqueta: `P-${suffix}`,
        peso: new Prisma.Decimal(3),
        valePonto: true,
        ativo: true,
      },
    });
    provaId = prova.id;

    const provaQuestao = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        provaId,
        enunciado: 'Qual alternativa está correta?',
        tipo: 'MULTIPLA_ESCOLHA',
        ordem: 1,
        peso: new Prisma.Decimal(1),
      },
    });
    provaQuestaoId = provaQuestao.id;

    const [altCorreta, altErrada] = await Promise.all([
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: { questaoId: provaQuestaoId, texto: 'Correta', ordem: 1, correta: true },
      }),
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: { questaoId: provaQuestaoId, texto: 'Errada', ordem: 2, correta: false },
      }),
    ]);
    provaAlternativaCorretaId = altCorreta.id;
    provaAlternativaErradaId = altErrada.id;

    const provaEnvio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        provaId,
        inscricaoId,
        realizadoEm: new Date(),
      },
    });
    provaEnvioId = provaEnvio.id;

    await prisma.cursosTurmasProvasRespostas.create({
      data: {
        questaoId: provaQuestaoId,
        inscricaoId,
        envioId: provaEnvioId,
        alternativaId: provaAlternativaErradaId,
      },
    });
    await prisma.auditoriaLogs.create({
      data: {
        categoria: 'CURSO',
        tipo: 'PROVA_RESPOSTA',
        acao: 'RESPOSTA_REGISTRADA',
        usuarioId: aluno.id,
        entidadeId: provaEnvioId,
        entidadeTipo: 'PROVA_RESPOSTA',
        descricao: `Envio de resposta na avaliação ${provaId}`,
        ip: provaEnvioIp,
      },
    });

    const atividade = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId,
        turmaId,
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: `Atividade discursiva ${suffix}`,
        etiqueta: `A-${suffix}`,
        peso: new Prisma.Decimal(2),
        valePonto: true,
        ativo: true,
      },
    });
    atividadeDiscursivaId = atividade.id;

    const atividadeQuestao = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        provaId: atividadeDiscursivaId,
        enunciado: 'Descreva sua resposta',
        tipo: 'TEXTO',
        ordem: 1,
        peso: new Prisma.Decimal(1),
      },
    });
    atividadeQuestaoId = atividadeQuestao.id;

    const atividadeEnvio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        provaId: atividadeDiscursivaId,
        inscricaoId,
        realizadoEm: new Date(),
      },
    });
    atividadeEnvioId = atividadeEnvio.id;

    await prisma.cursosTurmasProvasRespostas.create({
      data: {
        questaoId: atividadeQuestaoId,
        inscricaoId,
        envioId: atividadeEnvioId,
        respostaTexto: 'Minha resposta discursiva',
        anexoUrl: 'https://example.com/resposta.pdf',
        anexoNome: 'resposta.pdf',
      },
    });
    await prisma.auditoriaLogs.create({
      data: {
        categoria: 'CURSO',
        tipo: 'PROVA_RESPOSTA',
        acao: 'RESPOSTA_REGISTRADA',
        usuarioId: aluno.id,
        entidadeId: atividadeEnvioId,
        entidadeTipo: 'PROVA_RESPOSTA',
        descricao: 'Resposta discursiva enviada',
        ip: atividadeEnvioIp,
      },
    });

    const atividadeSemNota = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId,
        turmaId,
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: `Atividade sem nota ${suffix}`,
        etiqueta: `AS-${suffix}`,
        peso: new Prisma.Decimal(0),
        valePonto: false,
        ativo: true,
      },
    });
    atividadeSemNotaId = atividadeSemNota.id;

    const atividadeSemNotaQuestao = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        provaId: atividadeSemNotaId,
        enunciado: 'Responda de forma objetiva',
        tipo: 'TEXTO',
        ordem: 1,
        peso: new Prisma.Decimal(0),
      },
    });
    atividadeSemNotaQuestaoId = atividadeSemNotaQuestao.id;

    const atividadeSemNotaEnvio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        provaId: atividadeSemNotaId,
        inscricaoId,
        realizadoEm: new Date(),
      },
    });
    atividadeSemNotaEnvioId = atividadeSemNotaEnvio.id;

    await prisma.cursosTurmasProvasRespostas.create({
      data: {
        questaoId: atividadeSemNotaQuestaoId,
        inscricaoId,
        envioId: atividadeSemNotaEnvioId,
        respostaTexto: 'Resposta sem nota',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditoriaLogs.deleteMany({
      where: {
        entidadeTipo: 'PROVA_RESPOSTA',
        entidadeId: { in: [provaEnvioId, atividadeEnvioId, atividadeSemNotaEnvioId] },
      },
    });
    await prisma.cursosTurmasProvasRespostas.deleteMany({
      where: { inscricaoId },
    });
    await prisma.cursosTurmasProvasQuestoesAlternativas.deleteMany({
      where: { questaoId: { in: [provaQuestaoId] } },
    });
    await prisma.cursosTurmasProvasQuestoes.deleteMany({
      where: { id: { in: [provaQuestaoId, atividadeQuestaoId, atividadeSemNotaQuestaoId] } },
    });
    await prisma.cursosTurmasProvasEnvios.deleteMany({
      where: { id: { in: [provaEnvioId, atividadeEnvioId, atividadeSemNotaEnvioId] } },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: [provaId, atividadeDiscursivaId, atividadeSemNotaId] } },
    });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: { id: { in: [inscricaoId, inscricaoSemRespostaId] } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    await prisma.cursos.deleteMany({ where: { id: cursoId } });

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('deve listar submissões da avaliação', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}/respostas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);

    const respostaComEnvio = response.body.data.find(
      (item: any) => item.inscricaoId === inscricaoId,
    );
    const respostaSemEnvio = response.body.data.find(
      (item: any) => item.inscricaoId === inscricaoSemRespostaId,
    );

    expect(respostaComEnvio).toMatchObject({
      avaliacaoId: provaId,
      inscricaoId,
      tipoAvaliacao: 'PROVA',
      statusCorrecao: 'PENDENTE',
      ipEnvio: provaEnvioIp,
    });
    expect(respostaComEnvio.concluidoEm).not.toBeNull();
    expect(respostaSemEnvio).toMatchObject({
      avaliacaoId: provaId,
      inscricaoId: inscricaoSemRespostaId,
      tipoAvaliacao: 'PROVA',
      statusCorrecao: 'PENDENTE',
      nota: null,
      concluidoEm: null,
    });
  });

  it('deve corrigir PROVA automaticamente ao responder e bloquear correção manual', async () => {
    const responderResponse = await request(app)
      .put(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes/${provaQuestaoId}/responder`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        alternativaId: provaAlternativaCorretaId,
      });
    expect(responderResponse.status).toBe(200);

    const detailResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}/respostas/${provaEnvioId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toHaveProperty('success', true);
    expect(detailResponse.body.data).toMatchObject({
      statusCorrecao: 'CORRIGIDA',
      nota: 3,
    });

    const listResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}/respostas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const row = listResponse.body.data.find((item: any) => item.inscricaoId === inscricaoId);
    expect(row).toBeTruthy();
    expect(row.statusCorrecao).toBe('CORRIGIDA');
    expect(row.nota).toBe(3);

    const patchResponse = await request(app)
      .patch(`/api/v1/cursos/avaliacoes/${provaId}/respostas/${provaEnvioId}/correcao`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 2,
        feedback: 'Tentativa manual',
        statusCorrecao: 'CORRIGIDA',
      })
      .expect(400);

    expect(patchResponse.body).toMatchObject({
      success: false,
      code: 'PROVA_AUTO_CORRECAO',
    });

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/historico?avaliacaoId=${provaId}&page=1&pageSize=200`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const eventoAuto = historicoResponse.body.data.find(
      (item: any) => item.acao === 'CORRECAO_AUTOMATICA',
    );
    expect(eventoAuto).toBeTruthy();
    expect(eventoAuto.acaoLabel).toBe('Correção automática');
    expect(eventoAuto.tipo).toBe('CORRECAO');
    expect(eventoAuto.tipoAvaliacao).toBe('PROVA');
  });

  it('deve retornar detalhe da submissão por questões', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}/respostas/${provaEnvioId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('avaliacaoId', provaId);
    expect(Array.isArray(response.body.data.itens)).toBe(true);
    expect(response.body.data).toHaveProperty('ipEnvio', provaEnvioIp);
    expect(response.body.data.concluidoEm).not.toBeNull();
    expect(response.body.data.itens[0]).toHaveProperty('respostaCorreta.alternativaId');
    expect(response.body.data.itens[0]).toHaveProperty('respostaAluno.alternativaId');
  });

  it('deve corrigir submissão discursiva e refletir no detalhe', async () => {
    const beforeResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas/${atividadeEnvioId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const beforeConcluidoEm = beforeResponse.body.data.concluidoEm;
    const beforeIpEnvio = beforeResponse.body.data.ipEnvio;

    const patchResponse = await request(app)
      .patch(
        `/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas/${atividadeEnvioId}/correcao`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 8.5,
        feedback: 'Bom desenvolvimento',
        statusCorrecao: 'CORRIGIDA',
      });

    expect(patchResponse.status).toBe(200);

    expect(patchResponse.body).toHaveProperty('success', true);
    expect(patchResponse.body.data).toHaveProperty('statusCorrecao', 'CORRIGIDA');
    expect(patchResponse.body.data).toHaveProperty('nota', 8.5);

    const detailResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas/${atividadeEnvioId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toHaveProperty('success', true);
    expect(detailResponse.body.data).toMatchObject({
      tipoAvaliacao: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      statusCorrecao: 'CORRIGIDA',
      nota: 8.5,
      ipEnvio: atividadeEnvioIp,
    });
    expect(detailResponse.body.data.concluidoEm).toBe(beforeConcluidoEm);
    expect(detailResponse.body.data.ipEnvio).toBe(beforeIpEnvio);
    expect(detailResponse.body.data.respostaAluno.texto).toBe('Minha resposta discursiva');

    const listResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas?page=1&pageSize=20`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const row = listResponse.body.data.find((item: any) => item.id === atividadeEnvioId);
    expect(row).toBeTruthy();
    expect(row.concluidoEm).toBe(beforeConcluidoEm);
    expect(row.ipEnvio).toBe(beforeIpEnvio);
  });

  it('deve filtrar listagem por statusCorrecao', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas?statusCorrecao=CORRIGIDA`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.every((item: any) => item.statusCorrecao === 'CORRIGIDA')).toBe(true);
  });

  it('deve registrar histórico de correção com descrição de nota e metadados de delta', async () => {
    const patchNotaEditada = await request(app)
      .patch(
        `/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas/${atividadeEnvioId}/correcao`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 7,
        feedback: 'Ajuste final da correção',
        statusCorrecao: 'CORRIGIDA',
      })
      .expect(200);

    expect(patchNotaEditada.body.data).toMatchObject({
      statusCorrecao: 'CORRIGIDA',
      nota: 7,
    });

    const patchSemMudancaNota = await request(app)
      .patch(
        `/api/v1/cursos/avaliacoes/${atividadeDiscursivaId}/respostas/${atividadeEnvioId}/correcao`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        feedback: 'Correção atualizada sem alterar nota',
        statusCorrecao: 'CORRIGIDA',
      })
      .expect(200);

    expect(patchSemMudancaNota.body.data).toMatchObject({
      statusCorrecao: 'CORRIGIDA',
      nota: 7,
    });

    const logs = await prisma.auditoriaLogs.findMany({
      where: {
        entidadeTipo: 'PROVA_RESPOSTA',
        entidadeId: atividadeEnvioId,
        tipo: 'PROVA_CORRECAO',
      },
      orderBy: { criadoEm: 'asc' },
      select: {
        acao: true,
        descricao: true,
        metadata: true,
      },
    });

    const logNotaRegistrada = logs.find((log) => log.acao === 'NOTA_REGISTRADA');
    const logNotaEditada = logs.find((log) => log.acao === 'NOTA_EDITADA');
    const logSemAlteracao = logs.find(
      (log) =>
        log.acao === 'CORRECAO_MANUAL' &&
        log.descricao === 'Correcao da atividade atualizada (sem alteracao de nota)',
    );

    expect(logNotaRegistrada?.descricao).toBe('Correcao da atividade: nota registrada 8,5');
    expect(logNotaEditada?.descricao).toBe('Correcao da atividade: nota antiga 8,5, nota nova 7,0');
    expect(logSemAlteracao).toBeTruthy();

    expect(logNotaEditada?.metadata).toMatchObject({
      notaAnterior: 8.5,
      notaNova: 7,
      statusCorrecaoAnterior: 'CORRIGIDA',
      statusCorrecaoNovo: 'CORRIGIDA',
      feedbackAlterado: true,
      corrigidoPorId: admin.id,
    });
    expect(typeof (logNotaEditada?.metadata as any)?.corrigidoEm).toBe('string');
  });

  it('deve listar histórico da avaliação no endpoint dedicado', async () => {
    const response = await request(app)
      .get(
        `/api/v1/cursos/avaliacoes/historico?avaliacaoId=${atividadeDiscursivaId}&page=1&pageSize=200`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      pageSize: 200,
    });

    const temNotaEditada = response.body.data.some(
      (item: any) =>
        item.acao === 'NOTA_EDITADA' &&
        item.acaoLabel === 'Nota editada' &&
        item.tipo === 'CORRECAO' &&
        item.descricao === 'Correcao da atividade: nota antiga 8,5, nota nova 7,0',
    );
    expect(temNotaEditada).toBe(true);
  });

  it('deve normalizar descrição de resposta no histórico sem expor UUID da avaliação', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/historico?avaliacaoId=${provaId}&page=1&pageSize=50`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    const respostaRegistrada = response.body.data.find(
      (item: any) => item.acao === 'RESPOSTA_REGISTRADA',
    );

    expect(respostaRegistrada).toBeTruthy();
    expect(respostaRegistrada.descricao).toMatch(/^Submissão /);
    expect(respostaRegistrada.descricao).not.toContain(provaId);
    expect(respostaRegistrada.tipoAvaliacao).toBe('PROVA');
    expect(respostaRegistrada.tipoAvaliacaoLabel).toBe('Prova');
  });

  it('deve aceitar correção com nota em atividade sem valePonto e persistir a nota', async () => {
    const patchResponse = await request(app)
      .patch(
        `/api/v1/cursos/avaliacoes/${atividadeSemNotaId}/respostas/${atividadeSemNotaEnvioId}/correcao`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 10,
        feedback: 'Feedback apenas textual',
        statusCorrecao: 'CORRIGIDA',
      })
      .expect(200);

    expect(patchResponse.body).toHaveProperty('success', true);
    expect(patchResponse.body.data).toMatchObject({
      statusCorrecao: 'CORRIGIDA',
      nota: 10,
    });

    const detailResponse = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeSemNotaId}/respostas/${atividadeSemNotaEnvioId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toHaveProperty('success', true);
    expect(detailResponse.body.data).toMatchObject({
      statusCorrecao: 'CORRIGIDA',
      nota: 10,
      feedback: 'Feedback apenas textual',
    });
  });

  it('deve rejeitar nota fora da faixa permitida', async () => {
    const response = await request(app)
      .patch(
        `/api/v1/cursos/avaliacoes/${atividadeSemNotaId}/respostas/${atividadeSemNotaEnvioId}/correcao`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 10.5,
        statusCorrecao: 'CORRIGIDA',
      })
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});
