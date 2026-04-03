import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import {
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Roles,
  StatusDeVagas,
  TiposDeUsuarios,
  type StatusProcessosCandidatos,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { encodeInterviewChannel } from '@/modules/entrevistas/utils/presentation';

import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';

const createUniqueCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

jest.setTimeout(60000);

async function createVaga(params: {
  empresaUsuarioId: string;
  titulo: string;
  modoAnonimo?: boolean;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await prisma.empresasVagas.create({
        data: {
          codigo: createUniqueCode(),
          slug: `vaga-${randomUUID()}`,
          usuarioId: params.empresaUsuarioId,
          regimeDeTrabalho: RegimesDeTrabalhos.CLT,
          modalidade: ModalidadesDeVagas.REMOTO,
          titulo: params.titulo,
          requisitos: { obrigatorios: [], desejaveis: [] },
          atividades: { principais: [], extras: [] },
          beneficios: { lista: [], observacoes: null },
          status: StatusDeVagas.PUBLICADO,
          modoAnonimo: params.modoAnonimo ?? false,
        },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          usuarioId: true,
          modoAnonimo: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
  }

  throw new Error('Falha ao criar vaga de teste do aluno');
}

describe('API - Cursos Alunos Entrevistas', () => {
  let app: Express;
  let statusProcesso: StatusProcessosCandidatos;

  const testUsers: TestUser[] = [];
  const createdCurriculos: string[] = [];
  const createdEntrevistas: string[] = [];
  const createdCandidaturas: string[] = [];
  const createdVagas: string[] = [];
  const createdEnderecos: string[] = [];
  const createdVinculos: { recrutadorId: string; vagaId: string }[] = [];

  beforeAll(async () => {
    app = await getTestApp();

    const existingStatus = await prisma.statusProcessosCandidatos.findFirst({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    if (!existingStatus) {
      throw new Error('Nenhum status de processo de candidatos ativo encontrado para o teste');
    }

    statusProcesso = existingStatus;
  });

  afterAll(async () => {
    if (createdEntrevistas.length > 0) {
      await prisma.empresasVagasEntrevistas.deleteMany({
        where: { id: { in: createdEntrevistas } },
      });
    }

    if (createdCandidaturas.length > 0) {
      await prisma.empresasCandidatos.deleteMany({
        where: { id: { in: createdCandidaturas } },
      });
    }

    if (createdCurriculos.length > 0) {
      await prisma.usuariosCurriculos.deleteMany({
        where: { id: { in: createdCurriculos } },
      });
    }

    if (createdEnderecos.length > 0) {
      await prisma.usuariosEnderecos.deleteMany({
        where: { id: { in: createdEnderecos } },
      });
    }

    if (createdVinculos.length > 0) {
      await prisma.usuariosVagasVinculos.deleteMany({
        where: {
          OR: createdVinculos.map((item) => ({
            recrutadorId: item.recrutadorId,
            vagaId: item.vagaId,
          })),
        },
      });
    }

    if (createdVagas.length > 0) {
      await prisma.empresasVagas.deleteMany({
        where: { id: { in: createdVagas } },
      });
    }

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  const createFixture = async () => {
    const admin = await createTestUser({ role: Roles.ADMIN, nomeCompleto: 'Admin Alunos' });
    const moderator = await createTestUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Moderador Alunos',
    });
    const aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Pedro Oliveira',
    });
    const outroAluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Outro Aluno',
    });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `9${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Consultoria RH Plus',
    });
    const recrutador = await createTestUser({
      role: Roles.RECRUTADOR,
      nomeCompleto: 'Ana Setor de Vagas',
      email: `ana.${randomUUID()}@test.com`,
    });

    testUsers.push(admin, moderator, aluno, outroAluno, empresa, recrutador);

    await prisma.usuarios.update({
      where: { id: recrutador.id },
      data: { googleCalendarId: 'primary' },
    });

    const enderecoAluno = await prisma.usuariosEnderecos.create({
      data: {
        usuarioId: aluno.id,
        cidade: 'Maceió',
        estado: 'AL',
        bairro: 'Centro',
        logradouro: 'Rua do Aluno',
        numero: '100',
        cep: '57000000',
      },
      select: { id: true },
    });
    createdEnderecos.push(enderecoAluno.id);

    const curriculoPrincipal = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: aluno.id,
        titulo: 'Currículo Principal',
        principal: true,
      },
      select: { id: true },
    });
    const curriculoSecundario = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: aluno.id,
        titulo: 'Currículo Secundário',
        principal: false,
      },
      select: { id: true },
    });
    createdCurriculos.push(curriculoPrincipal.id, curriculoSecundario.id);

    const vagaOnline = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: 'Estagiário de Recursos Humanos',
    });
    const vagaPresencial = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: 'Analista Presencial',
      modoAnonimo: true,
    });
    const vagaDireta = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: 'Assistente de Campo',
    });
    createdVagas.push(vagaOnline.id, vagaPresencial.id, vagaDireta.id);

    const candidaturaOnline = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOnline.id,
        candidatoId: aluno.id,
        empresaUsuarioId: empresa.id,
        statusId: statusProcesso.id,
        curriculoId: curriculoPrincipal.id,
      },
      select: { id: true },
    });
    const candidaturaPresencial = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPresencial.id,
        candidatoId: aluno.id,
        empresaUsuarioId: empresa.id,
        statusId: statusProcesso.id,
        curriculoId: curriculoPrincipal.id,
      },
      select: { id: true },
    });
    const candidaturaDireta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaDireta.id,
        candidatoId: aluno.id,
        empresaUsuarioId: empresa.id,
        statusId: statusProcesso.id,
        curriculoId: curriculoPrincipal.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaOnline.id, candidaturaPresencial.id, candidaturaDireta.id);

    await prisma.usuariosVagasVinculos.createMany({
      data: [
        { recrutadorId: recrutador.id, vagaId: vagaOnline.id },
        { recrutadorId: recrutador.id, vagaId: vagaDireta.id },
      ],
    });
    createdVinculos.push(
      { recrutadorId: recrutador.id, vagaId: vagaOnline.id },
      { recrutadorId: recrutador.id, vagaId: vagaDireta.id },
    );

    const onlineStart = new Date('2026-03-31T18:00:00.000Z');
    const presencialStart = new Date('2026-03-31T16:00:00.000Z');
    const enderecoPresencial = {
      cep: '57084-028',
      logradouro: 'Rua Manoel Pedro de Oliveira',
      numero: '245',
      complemento: 'Sala 5',
      bairro: 'Benedito Bentes',
      cidade: 'Maceió',
      estado: 'AL',
      pontoReferencia: 'Próximo ao shopping',
    };

    const entrevistaOnline = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaOnline.id,
        candidatoId: aluno.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recrutador.id,
        titulo: 'Entrevista — Pedro Oliveira',
        descricao: 'Entrevista técnica online.',
        dataInicio: onlineStart,
        dataFim: new Date(onlineStart.getTime() + 60 * 60 * 1000),
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        meetEventId: 'evt-online-test',
        status: 'AGENDADA',
      },
      select: { id: true },
    });
    const entrevistaPresencial = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaPresencial.id,
        candidatoId: aluno.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recrutador.id,
        titulo: 'Entrevista — Mariana Presencial',
        descricao: 'Analista Presencial',
        dataInicio: presencialStart,
        dataFim: new Date(presencialStart.getTime() + 60 * 60 * 1000),
        meetUrl: encodeInterviewChannel({
          modalidade: 'PRESENCIAL',
          enderecoPresencial,
        }),
        status: 'AGENDADA',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevistaOnline.id, entrevistaPresencial.id);

    return {
      admin,
      moderator,
      aluno,
      outroAluno,
      empresa,
      recrutador,
      curriculoPrincipal,
      candidaturaDireta,
      entrevistaOnline,
      entrevistaPresencial,
    };
  };

  it('enriquece o detalhe do aluno com curriculosResumo e restringe ALUNO_CANDIDATO ao próprio escopo', async () => {
    const fixture = await createFixture();

    const adminResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}`)
      .set('Authorization', `Bearer ${fixture.admin.token}`)
      .expect(200);

    expect(adminResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: fixture.aluno.id,
          nomeCompleto: fixture.aluno.nomeCompleto,
          curriculosResumo: {
            total: 2,
            principalId: fixture.curriculoPrincipal.id,
          },
        }),
      }),
    );

    const ownResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}`)
      .set('Authorization', `Bearer ${fixture.aluno.token}`)
      .expect(200);

    expect(ownResponse.body.data.curriculosResumo).toEqual({
      total: 2,
      principalId: fixture.curriculoPrincipal.id,
    });

    const recruiterOwnScopeResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(recruiterOwnScopeResponse.body.data.id).toBe(fixture.aluno.id);

    const otherStudentResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.outroAluno.id}`)
      .set('Authorization', `Bearer ${fixture.aluno.token}`)
      .expect(403);

    expect(otherStudentResponse.body).toEqual({
      success: false,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Sem permissão para acessar dados de outro aluno.',
    });

    const recruiterForbiddenResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.outroAluno.id}`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(403);

    expect(recruiterForbiddenResponse.body).toEqual({
      success: false,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Sem permissão para acessar dados deste aluno.',
    });
  });

  it('lista entrevistas do aluno com contrato operacional para ADMIN, MODERADOR e o próprio aluno', async () => {
    const fixture = await createFixture();

    const moderatorResponse = await request(app)
      .get(
        `/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas?page=1&pageSize=10&modalidades=ONLINE,PRESENCIAL&statusEntrevista=AGENDADA`,
      )
      .set('Authorization', `Bearer ${fixture.moderator.token}`)
      .expect(200);

    expect(moderatorResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              id: fixture.entrevistaOnline.id,
              statusEntrevista: 'AGENDADA',
              modalidade: 'ONLINE',
              meetUrl: 'https://meet.google.com/abc-defg-hij',
              candidato: expect.objectContaining({
                id: fixture.aluno.id,
                nome: fixture.aluno.nomeCompleto,
              }),
              empresa: expect.objectContaining({
                nomeExibicao: 'Consultoria RH Plus',
                anonima: false,
                labelExibicao: 'Consultoria RH Plus',
              }),
              agenda: expect.objectContaining({
                eventoInternoId: fixture.entrevistaOnline.id,
                provider: 'GOOGLE_MEET',
                organizerSource: 'USER_OAUTH',
              }),
            }),
            expect.objectContaining({
              id: fixture.entrevistaPresencial.id,
              modalidade: 'PRESENCIAL',
              meetUrl: null,
              local: expect.stringContaining('Rua Manoel Pedro de Oliveira'),
              enderecoPresencial: expect.objectContaining({
                cidade: 'Maceió',
                estado: 'AL',
                bairro: 'Benedito Bentes',
              }),
              empresa: {
                id: fixture.empresa.id,
                nomeExibicao: null,
                anonima: true,
                labelExibicao: 'Empresa anônima',
              },
              agenda: expect.objectContaining({
                eventoInternoId: fixture.entrevistaPresencial.id,
                provider: 'INTERNAL_ONLY',
                organizerSource: 'SYSTEM',
              }),
            }),
          ]),
          pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1,
          },
        },
      }),
    );

    const ownResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${fixture.aluno.token}`)
      .expect(200);

    expect(ownResponse.body.data.items).toHaveLength(2);

    const recruiterResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(recruiterResponse.body.data.items).toHaveLength(1);
    expect(recruiterResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        id: fixture.entrevistaOnline.id,
        vaga: expect.objectContaining({
          titulo: 'Estagiário de Recursos Humanos',
        }),
      }),
    );
  });

  it('retorna vazio para aluno sem entrevistas e impede ALUNO_CANDIDATO de acessar entrevistas de outro aluno', async () => {
    const fixture = await createFixture();

    const emptyResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.outroAluno.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${fixture.admin.token}`)
      .expect(200);

    expect(emptyResponse.body).toEqual({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });

    const forbiddenResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.outroAluno.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${fixture.aluno.token}`)
      .expect(403);

    expect(forbiddenResponse.body).toEqual({
      success: false,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Sem permissão para acessar dados de outro aluno.',
    });
  });

  it('retorna opções de criação no contexto do aluno e cria entrevista presencial diretamente da tela do aluno', async () => {
    const fixture = await createFixture();

    const optionsResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas/opcoes`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(optionsResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          canCreate: true,
          canCreatePresencial: true,
          canCreateOnline: false,
          requiresGoogleForOnline: true,
          items: expect.arrayContaining([
            expect.objectContaining({
              candidaturaId: fixture.candidaturaDireta.id,
              entrevistaAtiva: false,
              empresaAnonima: false,
              anonimatoBloqueado: true,
            }),
            expect.objectContaining({
              entrevistaAtiva: true,
            }),
          ]),
        }),
      }),
    );

    const createResponse = await request(app)
      .post(`/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .send({
        candidaturaId: fixture.candidaturaDireta.id,
        modalidade: 'PRESENCIAL',
        dataInicio: '2026-04-01T14:00:00.000Z',
        dataFim: '2026-04-01T15:00:00.000Z',
        descricao: 'Entrevista presencial pelo detalhe do aluno.',
        empresaAnonima: false,
        enderecoPresencial: {
          cep: '57084-028',
          logradouro: 'Rua Manoel Pedro de Oliveira',
          numero: '245',
          complemento: 'Sala 5',
          bairro: 'Benedito Bentes',
          cidade: 'Maceió',
          estado: 'AL',
          pontoReferencia: 'Próximo ao shopping',
        },
      })
      .expect(201);

    createdEntrevistas.push(createResponse.body.data.id);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          candidaturaId: fixture.candidaturaDireta.id,
          modalidade: 'PRESENCIAL',
          meetUrl: null,
          agenda: expect.objectContaining({
            provider: 'INTERNAL_ONLY',
          }),
          empresa: expect.objectContaining({
            anonima: false,
            labelExibicao: 'Consultoria RH Plus',
          }),
        }),
      }),
    );

    const createdInterviewId = createResponse.body.data.id;

    const interviewsAfterCreate = await request(app)
      .get(`/api/v1/cursos/alunos/${fixture.aluno.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(interviewsAfterCreate.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdInterviewId,
          candidaturaId: fixture.candidaturaDireta.id,
          modalidade: 'PRESENCIAL',
        }),
      ]),
    );
  });
});
