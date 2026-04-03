import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import {
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Roles,
  StatusDeVagas,
  TiposDeUsuarios,
  type StatusProcessosCandidatos,
} from '@prisma/client';

jest.mock('@/modules/cursos/aulas/services/google-calendar.service', () => ({
  googleCalendarService: {
    createMeetEvent: jest.fn(async () => ({
      eventId: 'evt_test_123',
      meetUrl: 'https://meet.google.com/test-meet',
    })),
    sincronizarEntrevista: jest.fn(async () => undefined),
  },
}));

jest.setTimeout(30000);

const createUniqueCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

async function createVaga(params: {
  empresaUsuarioId: string;
  status: StatusDeVagas;
  titulo?: string;
  modalidade?: ModalidadesDeVagas;
  numeroVagas?: number;
  inscricoesAte?: Date | null;
  localizacao?: Record<string, unknown> | null;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await prisma.empresasVagas.create({
        data: {
          codigo: createUniqueCode(),
          slug: `vaga-${randomUUID()}`,
          usuarioId: params.empresaUsuarioId,
          regimeDeTrabalho: RegimesDeTrabalhos.CLT,
          modalidade: params.modalidade ?? ModalidadesDeVagas.REMOTO,
          titulo: params.titulo ?? 'Vaga Teste',
          requisitos: { obrigatorios: [], desejaveis: [] },
          atividades: { principais: [], extras: [] },
          beneficios: { lista: [], observacoes: null },
          status: params.status,
          numeroVagas: params.numeroVagas ?? 1,
          inscricoesAte: params.inscricoesAte ?? null,
          ...(params.localizacao ? { localizacao: params.localizacao } : {}),
        },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          status: true,
          usuarioId: true,
          numeroVagas: true,
          inscricoesAte: true,
          inseridaEm: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
  }
  throw new Error('Falha ao criar vaga de teste (código duplicado)');
}

async function getActiveStatusId() {
  const status = await prisma.statusProcessosCandidatos.findFirst({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true },
  });

  if (!status) {
    throw new Error('Nenhum status ativo encontrado para candidaturas de teste');
  }

  return status.id;
}

async function getTwoActiveStatuses() {
  const statuses = await prisma.statusProcessosCandidatos.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    take: 2,
    select: { id: true, nome: true },
  });

  if (statuses.length < 2) {
    throw new Error('São necessários ao menos dois status ativos para testar atualização');
  }

  return statuses;
}

describe('API - Recrutador (escopo por empresas vinculadas)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  const createdVagas: string[] = [];
  const createdCandidaturas: string[] = [];
  const createdCurriculos: string[] = [];
  const createdVinculos: string[] = [];
  const createdVagaVinculos: string[] = [];
  const createdEntrevistas: string[] = [];
  const createdNotificacoes: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdNotificacoes.length > 0) {
      await prisma.notificacoes.deleteMany({
        where: { id: { in: createdNotificacoes } },
      });
    }
    if (createdEntrevistas.length > 0) {
      await prisma.empresasVagasEntrevistas.deleteMany({
        where: { id: { in: createdEntrevistas } },
      });
    }
    if (createdCandidaturas.length > 0) {
      await prisma.empresasCandidatos.deleteMany({ where: { id: { in: createdCandidaturas } } });
    }
    if (createdCurriculos.length > 0) {
      await prisma.usuariosCurriculos.deleteMany({ where: { id: { in: createdCurriculos } } });
    }
    if (createdVagas.length > 0) {
      await prisma.empresasVagas.deleteMany({ where: { id: { in: createdVagas } } });
    }
    if (createdVinculos.length > 0) {
      await prisma.usuariosEmpresasVinculos.deleteMany({ where: { id: { in: createdVinculos } } });
    }
    if (createdVagaVinculos.length > 0) {
      await prisma.usuariosVagasVinculos.deleteMany({ where: { id: { in: createdVagaVinculos } } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('lista vagas enriquecidas no escopo do recrutador com filtros disponíveis e sem RASCUNHO', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `1${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresa);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vagaPublicada = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Desenvolvedor Full Stack Pleno',
      numeroVagas: 2,
      inscricoesAte: new Date('2026-04-18T23:59:59.000Z'),
      localizacao: {
        cidade: 'Maceió',
        estado: 'AL',
      },
    });
    createdVagas.push(vagaPublicada.id);

    const vagaRascunho = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.RASCUNHO,
      titulo: 'Vaga Rascunho',
    });
    createdVagas.push(vagaRascunho.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPublicada.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const empresasResp = await request(app)
      .get('/api/v1/recrutador/empresas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(empresasResp.body).toHaveProperty('success', true);
    expect(empresasResp.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: empresa.id })]),
    );

    const vagasResp = await request(app)
      .get('/api/v1/recrutador/vagas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(vagasResp.body).toHaveProperty('success', true);
    expect(Array.isArray(vagasResp.body.data)).toBe(true);
    expect(vagasResp.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );

    expect(vagasResp.body.filtrosDisponiveis).toEqual(
      expect.objectContaining({
        status: expect.arrayContaining([
          expect.objectContaining({
            value: 'PUBLICADO',
            label: 'Publicado',
            count: 1,
          }),
        ]),
        empresas: expect.arrayContaining([
          expect.objectContaining({
            id: empresa.id,
            count: 1,
          }),
        ]),
        localizacoes: expect.arrayContaining([
          expect.objectContaining({
            value: 'Maceió, AL',
            label: 'Maceió, AL',
            count: 1,
          }),
        ]),
      }),
    );

    expect(vagasResp.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: vagaPublicada.id,
          titulo: 'Desenvolvedor Full Stack Pleno',
          codigo: vagaPublicada.codigo,
          status: 'PUBLICADO',
          statusLabel: 'Publicado',
          empresaUsuarioId: empresa.id,
          numeroVagas: 2,
          inscricoesAte: '2026-04-18T23:59:59.000Z',
          escopo: {
            tipoAcesso: 'EMPRESA',
            empresaVinculadaDiretamente: true,
          },
          empresa: expect.objectContaining({
            id: empresa.id,
            nome: empresa.nomeCompleto,
            nomeExibicao: empresa.nomeCompleto,
            codUsuario: expect.any(String),
            cnpj: empresa.cnpj,
          }),
          localizacao: {
            cidade: 'Maceió',
            estado: 'AL',
            modalidadeLabel: 'Remoto',
            label: 'Maceió, AL',
          },
        }),
      ]),
    );

    const ids = vagasResp.body.data.map((v: any) => v.id);
    expect(ids).toContain(vagaPublicada.id);
    expect(ids).not.toContain(vagaRascunho.id);
  });

  it('aplica filtros escopados e não vaza vagas ou localizações fora do vínculo por vaga', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresaDireta = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: 'Empresa Escopo Direto',
      cnpj: `4${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const empresaVaga = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: 'Empresa Escopo por Vaga',
      cnpj: `5${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresaDireta, empresaVaga);

    const vinculoEmpresa = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresaDireta.id },
      select: { id: true },
    });
    createdVinculos.push(vinculoEmpresa.id);

    const vagaEmpresaDireta = await createVaga({
      empresaUsuarioId: empresaDireta.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Analista de QA',
      localizacao: { cidade: 'Arapiraca', estado: 'AL' },
    });
    const vagaEmpresaDiretaDois = await createVaga({
      empresaUsuarioId: empresaDireta.id,
      status: StatusDeVagas.DESPUBLICADA,
      titulo: 'Pessoa Desenvolvedora Backend',
      localizacao: { cidade: 'Maceió', estado: 'AL' },
    });
    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresaVaga.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Designer de Produto',
      localizacao: { cidade: 'Recife', estado: 'PE' },
    });
    const vagaBloqueadaMesmaEmpresa = await createVaga({
      empresaUsuarioId: empresaVaga.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Gestor Comercial',
      localizacao: { cidade: 'Salvador', estado: 'BA' },
    });
    createdVagas.push(
      vagaEmpresaDireta.id,
      vagaEmpresaDiretaDois.id,
      vagaPermitida.id,
      vagaBloqueadaMesmaEmpresa.id,
    );

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const response = await request(app)
      .get('/api/v1/recrutador/vagas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body.data.map((item: any) => item.id).sort()).toEqual(
      [vagaEmpresaDireta.id, vagaEmpresaDiretaDois.id, vagaPermitida.id].sort(),
    );
    expect(response.body.data.map((item: any) => item.id)).not.toContain(
      vagaBloqueadaMesmaEmpresa.id,
    );
    expect(response.body.filtrosDisponiveis.empresas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: empresaDireta.id, count: 2 }),
        expect.objectContaining({ id: empresaVaga.id, count: 1 }),
      ]),
    );
    expect(response.body.filtrosDisponiveis.localizacoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'Arapiraca, AL', count: 1 }),
        expect.objectContaining({ value: 'Maceió, AL', count: 1 }),
        expect.objectContaining({ value: 'Recife, PE', count: 1 }),
      ]),
    );
    expect(response.body.filtrosDisponiveis.localizacoes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'Salvador, BA' })]),
    );

    const searchResponse = await request(app)
      .get(`/api/v1/recrutador/vagas?search=${vagaPermitida.codigo}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(searchResponse.body.data).toHaveLength(1);
    expect(searchResponse.body.data[0]).toEqual(
      expect.objectContaining({
        id: vagaPermitida.id,
        codigo: vagaPermitida.codigo,
        escopo: {
          tipoAcesso: 'VAGA',
          empresaVinculadaDiretamente: false,
        },
      }),
    );

    const empresaFilterResponse = await request(app)
      .get(`/api/v1/recrutador/vagas?empresaUsuarioId=${empresaVaga.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(empresaFilterResponse.body.data).toHaveLength(1);
    expect(empresaFilterResponse.body.data[0].id).toBe(vagaPermitida.id);

    const localizacaoResponse = await request(app)
      .get('/api/v1/recrutador/vagas?localizacao=Recife,%20PE')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(localizacaoResponse.body.data).toHaveLength(1);
    expect(localizacaoResponse.body.data[0].id).toBe(vagaPermitida.id);
    expect(localizacaoResponse.body.filtrosDisponiveis.localizacoes).toEqual([
      expect.objectContaining({
        value: 'Recife, PE',
        count: 1,
      }),
    ]);
  });

  it('lista candidatos da vaga no escopo do recrutador com busca, período e resumo de currículo', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `6${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidatoVisivel = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Joao da Silva',
      email: `joao-${randomUUID()}@test.com`,
    });
    const candidatoPeriodo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Maria Souza',
      email: `maria-${randomUUID()}@test.com`,
    });
    const candidatoOculto = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Pedro Oculto',
      email: `pedro-${randomUUID()}@test.com`,
    });
    testUsers.push(recruiter, empresa, candidatoVisivel, candidatoPeriodo, candidatoOculto);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'DevOps Engineer',
    });
    const vagaOculta = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Outra Vaga da Empresa',
    });
    createdVagas.push(vagaPermitida.id, vagaOculta.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const curriculoVisivel = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidatoVisivel.id,
        titulo: 'Curriculo DevOps',
        principal: true,
        experiencias: [{ empresa: 'A' }, { empresa: 'B' }, { empresa: 'C' }],
        formacao: [{ curso: 'Ciencia da Computacao' }],
      },
      select: { id: true },
    });
    const curriculoPeriodo = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidatoPeriodo.id,
        titulo: 'Curriculo Plataforma',
        principal: true,
        experiencias: [{ empresa: 'X' }],
        formacao: [{ curso: 'Sistemas de Informacao' }],
      },
      select: { id: true },
    });
    const curriculoOculto = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidatoOculto.id,
        titulo: 'Curriculo Fora do Escopo',
        principal: true,
      },
      select: { id: true },
    });
    createdCurriculos.push(curriculoVisivel.id, curriculoPeriodo.id, curriculoOculto.id);

    const statusId = await getActiveStatusId();

    const candidaturaVisivel = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidatoVisivel.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoVisivel.id,
        aplicadaEm: new Date('2026-04-02T10:00:00.000Z'),
        atualizadaEm: new Date('2026-04-02T11:00:00.000Z'),
      },
      select: { id: true },
    });
    const candidaturaPeriodo = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidatoPeriodo.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoPeriodo.id,
        aplicadaEm: new Date('2026-04-10T09:00:00.000Z'),
        atualizadaEm: new Date('2026-04-10T10:00:00.000Z'),
      },
      select: { id: true },
    });
    const candidaturaOculta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidatoOculto.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoOculto.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaVisivel.id, candidaturaPeriodo.id, candidaturaOculta.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/vagas/${vagaPermitida.id}/candidatos?sortBy=nome&sortDir=asc`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.vaga).toEqual({
      id: vagaPermitida.id,
      titulo: 'DevOps Engineer',
      codigo: vagaPermitida.codigo,
      status: 'PUBLICADO',
    });
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items.map((item: any) => item.candidato.nomeCompleto)).toEqual([
      'Joao da Silva',
      'Maria Souza',
    ]);
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidaturaId: candidaturaVisivel.id,
          statusCandidatura: expect.any(String),
          statusCandidaturaLabel: expect.any(String),
          criadoEm: '2026-04-02T10:00:00.000Z',
          atualizadoEm: '2026-04-02T11:00:00.000Z',
          candidato: expect.objectContaining({
            id: candidatoVisivel.id,
            nomeCompleto: 'Joao da Silva',
            email: candidatoVisivel.email,
          }),
          curriculosResumo: {
            total: 1,
            principalTitulo: 'Curriculo DevOps',
          },
          curriculo: expect.objectContaining({
            id: curriculoVisivel.id,
            titulo: 'Curriculo DevOps',
            principal: true,
          }),
          experienciaResumo: '3 experiências',
          formacaoResumo: 'Ciencia da Computacao',
        }),
      ]),
    );
    expect(response.body.data.items.map((item: any) => item.candidato.id)).not.toContain(
      candidatoOculto.id,
    );

    const searchResponse = await request(app)
      .get(`/api/v1/recrutador/vagas/${vagaPermitida.id}/candidatos?search=joao`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(searchResponse.body.data.items).toHaveLength(1);
    expect(searchResponse.body.data.items[0].candidato.id).toBe(candidatoVisivel.id);

    const periodResponse = await request(app)
      .get(
        `/api/v1/recrutador/vagas/${vagaPermitida.id}/candidatos?inscricaoDe=2026-04-05T00:00:00.000Z&inscricaoAte=2026-04-12T23:59:59.999Z`,
      )
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(periodResponse.body.data.items).toHaveLength(1);
    expect(periodResponse.body.data.items[0].candidato.id).toBe(candidatoPeriodo.id);
  });

  it('bloqueia listagem de candidatos quando a vaga está fora do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `7${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresa);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora do Escopo',
    });
    createdVagas.push(vaga.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/vagas/${vaga.id}/candidatos`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
        message: 'Você não possui acesso aos candidatos desta vaga.',
      }),
    );
  });

  it('retorna 404 ao listar candidatos de vaga inexistente no recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    testUsers.push(recruiter);

    const response = await request(app)
      .get(`/api/v1/recrutador/vagas/${randomUUID()}/candidatos`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'VAGA_NOT_FOUND',
        message: 'Vaga não encontrada.',
      }),
    );
  });

  it('atualiza o status da candidatura da vaga dentro do escopo por vínculo de empresa', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Status Empresa',
    });
    createdVagas.push(vaga.id);

    const [currentStatus, nextStatus] = await getTwoActiveStatuses();

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId: currentStatus.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .patch(`/api/v1/recrutador/vagas/${vaga.id}/candidaturas/${candidatura.id}/status`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ statusId: nextStatus.id })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          candidaturaId: candidatura.id,
          vagaId: vaga.id,
          statusId: nextStatus.id,
          status: nextStatus.nome,
          statusLabel: expect.any(String),
          atualizadoEm: expect.any(String),
        }),
      }),
    );

    const candidaturaAtualizada = await prisma.empresasCandidatos.findUnique({
      where: { id: candidatura.id },
      select: {
        statusId: true,
        atualizadaEm: true,
      },
    });

    expect(candidaturaAtualizada?.statusId).toBe(nextStatus.id);
    expect(candidaturaAtualizada?.atualizadaEm.toISOString()).toBe(response.body.data.atualizadoEm);

    const notificacao = await prisma.notificacoes.findFirst({
      where: {
        usuarioId: candidato.id,
        candidaturaId: candidatura.id,
      },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensagem: true,
        vagaId: true,
        candidaturaId: true,
        dados: true,
      },
    });

    expect(notificacao).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        tipo: 'SISTEMA',
        titulo: 'Status da candidatura atualizado',
        vagaId: vaga.id,
        candidaturaId: candidatura.id,
      }),
    );
    expect(notificacao?.mensagem).toContain('Vaga Status Empresa');
    expect(notificacao?.mensagem).toContain('foi atualizada para');
    expect(notificacao?.dados).toEqual(
      expect.objectContaining({
        evento: 'CANDIDATURA_STATUS_ATUALIZADO',
        origem: 'PAINEL_RECRUTADOR',
        candidaturaId: candidatura.id,
        vagaId: vaga.id,
        empresaUsuarioId: empresa.id,
        vagaTitulo: 'Vaga Status Empresa',
        statusIdAnterior: currentStatus.id,
        statusAnterior: currentStatus.nome,
        statusIdNovo: nextStatus.id,
        statusNovo: nextStatus.nome,
      }),
    );

    if (notificacao) {
      createdNotificacoes.push(notificacao.id);
    }

    const notificacoesResponse = await request(app)
      .get('/api/v1/notificacoes?pageSize=10')
      .set('Authorization', `Bearer ${candidato.token}`)
      .expect(200);

    expect(notificacoesResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: notificacao?.id,
          tipo: 'SISTEMA',
          titulo: 'Status da candidatura atualizado',
          mensagem: expect.stringContaining('Vaga Status Empresa'),
          vaga: expect.objectContaining({
            id: vaga.id,
            titulo: 'Vaga Status Empresa',
          }),
          dados: expect.objectContaining({
            candidaturaId: candidatura.id,
            vagaId: vaga.id,
            evento: 'CANDIDATURA_STATUS_ATUALIZADO',
          }),
        }),
      ]),
    );
  });

  it('atualiza o status da candidatura da vaga dentro do escopo por vínculo de vaga', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `9${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Status Restrita',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vaga.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const [currentStatus, nextStatus] = await getTwoActiveStatuses();

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId: currentStatus.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .patch(`/api/v1/recrutador/vagas/${vaga.id}/candidaturas/${candidatura.id}/status`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ statusId: nextStatus.id })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        candidaturaId: candidatura.id,
        vagaId: vaga.id,
        statusId: nextStatus.id,
        status: nextStatus.nome,
      }),
    );
  });

  it('retorna conflito quando a candidatura não pertence à vaga informada', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `3${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vagaA = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga A',
    });
    const vagaB = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga B',
    });
    createdVagas.push(vagaA.id, vagaB.id);

    const statusId = await getActiveStatusId();
    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaB.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .patch(`/api/v1/recrutador/vagas/${vagaA.id}/candidaturas/${candidatura.id}/status`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ statusId })
      .expect(409);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'RECRUITER_SCOPE_CONFLICT',
        message: 'A candidatura informada não pertence à vaga selecionada.',
      }),
    );
  });

  it('bloqueia atualização de status da candidatura fora do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `4${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora do Escopo para Status',
    });
    createdVagas.push(vaga.id);

    const statusId = await getActiveStatusId();
    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .patch(`/api/v1/recrutador/vagas/${vaga.id}/candidaturas/${candidatura.id}/status`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ statusId })
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
        message: 'Você não possui acesso para alterar o status desta candidatura.',
      }),
    );
  });

  it('retorna 404 quando o status informado não existe', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `5${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: {
        recrutadorId: recruiter.id,
        vagaId: (
          await createVaga({
            empresaUsuarioId: empresa.id,
            status: StatusDeVagas.PUBLICADO,
            titulo: 'Vaga Status Inexistente',
          })
        ).id,
      },
      select: { id: true, vagaId: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);
    createdVagas.push(vinculoVaga.vagaId);

    const statusId = await getActiveStatusId();
    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vinculoVaga.vagaId,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .patch(`/api/v1/recrutador/vagas/${vinculoVaga.vagaId}/candidaturas/${candidatura.id}/status`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ statusId: randomUUID() })
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'STATUS_NOT_FOUND',
        message: 'Status não encontrado.',
      }),
    );
  });

  it('abre detalhe da empresa no escopo por vínculo de empresa e limita vagas operáveis', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `3${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresa);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vagaPublicada = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Publicada Escopo',
    });
    const vagaDespublicada = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.DESPUBLICADA,
      titulo: 'Vaga Despublicada Escopo',
    });
    const vagaRascunho = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.RASCUNHO,
      titulo: 'Vaga Rascunho Escopo',
    });
    createdVagas.push(vagaPublicada.id, vagaDespublicada.id, vagaRascunho.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/empresas/${empresa.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.empresa).toEqual(
      expect.objectContaining({
        id: empresa.id,
      }),
    );
    expect(response.body.data.escopo).toEqual(
      expect.objectContaining({
        tipoAcesso: 'EMPRESA',
        empresaVinculadaDiretamente: true,
        totalVagasNoEscopo: 2,
      }),
    );

    const vagaIds = response.body.data.vagas.map((vaga: any) => vaga.id);
    expect(vagaIds).toContain(vagaPublicada.id);
    expect(vagaIds).toContain(vagaDespublicada.id);
    expect(vagaIds).not.toContain(vagaRascunho.id);
  });

  it('abre empresa com visão limitada por vínculo de vaga e bloqueia vaga fora do escopo', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `4${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresa);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Permitida',
    });
    const vagaBloqueada = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Bloqueada',
    });
    createdVagas.push(vagaPermitida.id, vagaBloqueada.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const empresaResp = await request(app)
      .get(`/api/v1/recrutador/empresas/${empresa.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(empresaResp.body).toHaveProperty('success', true);
    expect(empresaResp.body.data.escopo).toEqual(
      expect.objectContaining({
        tipoAcesso: 'VAGA',
        empresaVinculadaDiretamente: false,
        totalVagasNoEscopo: 1,
      }),
    );
    expect(empresaResp.body.data.vagas).toHaveLength(1);
    expect(empresaResp.body.data.vagas[0]).toEqual(
      expect.objectContaining({
        id: vagaPermitida.id,
      }),
    );

    const vagaPermitidaResp = await request(app)
      .get(`/api/v1/recrutador/vagas/${vagaPermitida.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(vagaPermitidaResp.body).toHaveProperty('success', true);
    expect(vagaPermitidaResp.body.data).toEqual(
      expect.objectContaining({
        id: vagaPermitida.id,
      }),
    );

    const vagaBloqueadaResp = await request(app)
      .get(`/api/v1/recrutador/vagas/${vagaBloqueada.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(vagaBloqueadaResp.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
      }),
    );
  });

  it('lista apenas candidatos dentro do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresaPermitida = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `5${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const empresaForaEscopo = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `6${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidatoPermitido = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    const candidatoForaEscopo = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(
      recruiter,
      empresaPermitida,
      empresaForaEscopo,
      candidatoPermitido,
      candidatoForaEscopo,
    );

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresaPermitida.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresaPermitida.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Permitida Candidato',
    });
    const vagaForaEscopo = await createVaga({
      empresaUsuarioId: empresaForaEscopo.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora do Escopo',
    });
    createdVagas.push(vagaPermitida.id, vagaForaEscopo.id);

    const statusId = await getActiveStatusId();

    const candidaturaPermitida = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidatoPermitido.id,
        empresaUsuarioId: empresaPermitida.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaForaEscopo = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaForaEscopo.id,
        candidatoId: candidatoForaEscopo.id,
        empresaUsuarioId: empresaForaEscopo.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaPermitida.id, candidaturaForaEscopo.id);

    const response = await request(app)
      .get('/api/v1/recrutador/candidatos')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      }),
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: candidatoPermitido.id,
      }),
    );
  });

  it('detalha candidato apenas com candidaturas visíveis no escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `7${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Permitida Detalhe',
    });
    const vagaOculta = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Oculta Detalhe',
    });
    createdVagas.push(vagaPermitida.id, vagaOculta.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();

    const curriculoVisivel = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidato.id,
        titulo: 'Curriculo Visivel',
        principal: true,
      },
      select: { id: true },
    });
    const curriculoOculto = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidato.id,
        titulo: 'Curriculo Oculto',
        principal: false,
      },
      select: { id: true },
    });
    createdCurriculos.push(curriculoVisivel.id, curriculoOculto.id);

    const candidaturaPermitida = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoVisivel.id,
      },
      select: { id: true },
    });
    const candidaturaOculta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoOculto.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaPermitida.id, candidaturaOculta.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.escopo).toEqual(
      expect.objectContaining({
        totalCandidaturasVisiveis: 1,
        tipoAcesso: 'VAGA',
      }),
    );
    expect(response.body.data.candidaturas).toHaveLength(1);
    expect(response.body.data.candidaturas[0]).toEqual(
      expect.objectContaining({
        id: candidaturaPermitida.id,
        curriculo: expect.objectContaining({
          id: curriculoVisivel.id,
          titulo: 'Curriculo Visivel',
          principal: true,
        }),
      }),
    );
  });

  it('retorna apenas currículo ligado a candidatura visível no escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Curriculo Visivel',
    });
    const vagaOculta = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Curriculo Oculto',
    });
    createdVagas.push(vagaPermitida.id, vagaOculta.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const curriculoVisivel = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidato.id,
        titulo: 'Curriculo Candidatura Visivel',
        principal: true,
      },
      select: { id: true },
    });
    const curriculoOculto = await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: candidato.id,
        titulo: 'Curriculo Fora do Escopo',
        principal: false,
      },
      select: { id: true },
    });
    createdCurriculos.push(curriculoVisivel.id, curriculoOculto.id);

    const statusId = await getActiveStatusId();

    const candidaturaVisivel = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoVisivel.id,
      },
      select: { id: true },
    });
    const candidaturaOculta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
        curriculoId: curriculoOculto.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaVisivel.id, candidaturaOculta.id);

    const visibleResponse = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}/curriculos/${curriculoVisivel.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(visibleResponse.body).toHaveProperty('success', true);
    expect(visibleResponse.body.data).toEqual(
      expect.objectContaining({
        id: curriculoVisivel.id,
        usuarioId: candidato.id,
        titulo: 'Curriculo Candidatura Visivel',
      }),
    );

    const hiddenResponse = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}/curriculos/${curriculoOculto.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(hiddenResponse.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
      }),
    );
  });

  it('lista apenas entrevistas do candidato dentro do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `9${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Entrevista Visivel',
    });
    const vagaOculta = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Entrevista Oculta',
    });
    createdVagas.push(vagaPermitida.id, vagaOculta.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();

    const candidaturaPermitida = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaOculta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaPermitida.id, candidaturaOculta.id);

    const entrevistaPermitida = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaPermitida.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Permitida',
        descricao: 'Entrevista online no escopo.',
        dataInicio: new Date('2026-04-10T14:00:00.000Z'),
        dataFim: new Date('2026-04-10T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        meetEventId: 'evt_visible',
      },
      select: { id: true },
    });
    const entrevistaOculta = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Oculta',
        descricao: 'Entrevista fora do escopo.',
        dataInicio: new Date('2026-04-11T14:00:00.000Z'),
        dataFim: new Date('2026-04-11T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/hid-test-int',
        meetEventId: 'evt_hidden',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevistaPermitida.id, entrevistaOculta.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}/entrevistas`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      }),
    );
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        id: entrevistaPermitida.id,
        statusEntrevista: 'AGENDADA',
        modalidade: 'ONLINE',
        vaga: expect.objectContaining({
          id: vagaPermitida.id,
        }),
      }),
    );
  });

  it('lista overview de entrevistas apenas no escopo do recrutador com summary e filtros do próprio escopo', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `5${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Tech Innovations LTDA',
    });
    const candidato = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Ana Costa',
    });
    testUsers.push(recruiter, empresa, candidato);

    const vagaVisivel = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Desenvolvedor Full Stack Pleno',
    });
    const vagaOculta = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora do Escopo',
    });
    createdVagas.push(vagaVisivel.id, vagaOculta.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaVisivel.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();

    const candidaturaVisivel = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaVisivel.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaOculta = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaVisivel.id, candidaturaOculta.id);

    const entrevistaVisivel = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaVisivel.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Visível Overview',
        descricao: 'Entrevista técnica online.',
        dataInicio: new Date('2026-04-10T14:00:00.000Z'),
        dataFim: new Date('2026-04-10T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        meetEventId: 'evt_overview_visible',
      },
      select: { id: true },
    });
    const entrevistaOculta = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaOculta.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Oculta Overview',
        descricao: 'Entrevista fora do vínculo.',
        dataInicio: new Date('2026-04-11T14:00:00.000Z'),
        dataFim: new Date('2026-04-11T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/hid-over-view',
        meetEventId: 'evt_overview_hidden',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevistaVisivel.id, entrevistaOculta.id);

    const response = await request(app)
      .get('/api/v1/recrutador/entrevistas/overview')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          }),
          summary: {
            totalEntrevistas: 1,
            agendadas: 1,
            confirmadas: 0,
            realizadas: 0,
            canceladas: 0,
            naoCompareceram: 0,
          },
          filtrosDisponiveis: expect.objectContaining({
            statusEntrevista: [
              expect.objectContaining({
                value: 'AGENDADA',
                count: 1,
              }),
            ],
            modalidades: [
              expect.objectContaining({
                value: 'ONLINE',
                count: 1,
              }),
            ],
          }),
          capabilities: expect.objectContaining({
            canCreate: false,
            canCreateOnline: false,
            canCreatePresencial: false,
            requiresGoogleForOnline: true,
          }),
          items: [
            expect.objectContaining({
              id: entrevistaVisivel.id,
              candidaturaId: candidaturaVisivel.id,
              modalidade: 'ONLINE',
              candidato: expect.objectContaining({
                id: candidato.id,
                nome: candidato.nomeCompleto,
              }),
              vaga: expect.objectContaining({
                id: vagaVisivel.id,
              }),
              empresa: expect.objectContaining({
                id: empresa.id,
                nomeExibicao: empresa.nomeCompleto,
                anonima: false,
                labelExibicao: empresa.nomeCompleto,
              }),
            }),
          ],
        }),
      }),
    );
  });

  it('bloqueia detalhe de entrevista fora do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `6${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vagaVisivel = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Base Escopo',
    });
    const vagaForaEscopo = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora Escopo Entrevista',
    });
    createdVagas.push(vagaVisivel.id, vagaForaEscopo.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaVisivel.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const entrevistaForaEscopo = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaForaEscopo.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Fora Escopo',
        descricao: 'Nao deve abrir no detalhe.',
        dataInicio: new Date('2026-04-12T14:00:00.000Z'),
        dataFim: new Date('2026-04-12T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/out-side-scp',
        meetEventId: 'evt_forbidden',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevistaForaEscopo.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/entrevistas/${entrevistaForaEscopo.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
        message: 'Você não possui acesso a esta entrevista.',
      }),
    );
  });

  it('retorna opções de criação de entrevista no detalhe do candidato com defaults e escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `7${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Escopo Direto',
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculoEmpresa = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculoEmpresa.id);

    const vagaCriavel = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Criavel Recrutador',
    });
    const vagaComEntrevistaAtiva = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Com Entrevista Ativa',
    });
    createdVagas.push(vagaCriavel.id, vagaComEntrevistaAtiva.id);

    const statusId = await getActiveStatusId();

    const candidaturaCriavel = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaCriavel.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaAtiva = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaComEntrevistaAtiva.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaCriavel.id, candidaturaAtiva.id);

    const entrevistaAtiva = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vagaComEntrevistaAtiva.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recruiter.id,
        titulo: 'Entrevista Ativa Escopo',
        descricao: 'Entrevista já existente.',
        dataInicio: new Date('2026-04-09T14:00:00.000Z'),
        dataFim: new Date('2026-04-09T15:00:00.000Z'),
        meetUrl: 'https://meet.google.com/alr-eady-int',
        meetEventId: 'evt_active_scope',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevistaAtiva.id);

    const response = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}/entrevistas/opcoes`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          canCreate: true,
          requiresGoogleForOnline: true,
          defaults: {
            empresaUsuarioId: empresa.id,
            vagaId: vagaCriavel.id,
            candidaturaId: candidaturaCriavel.id,
          },
          items: expect.arrayContaining([
            expect.objectContaining({
              candidaturaId: candidaturaCriavel.id,
              tipoAcesso: 'EMPRESA',
              empresaVinculadaDiretamente: true,
              entrevistaAtiva: false,
            }),
            expect.objectContaining({
              candidaturaId: candidaturaAtiva.id,
              tipoAcesso: 'EMPRESA',
              empresaVinculadaDiretamente: true,
              entrevistaAtiva: true,
              entrevistaAtivaId: entrevistaAtiva.id,
            }),
          ]),
        }),
      }),
    );
  });

  it('cria entrevista presencial no detalhe do candidato respeitando o escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Detalhe Candidato',
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Presencial Recrutador',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vaga.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();
    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const response = await request(app)
      .post(`/api/v1/recrutador/candidatos/${candidato.id}/entrevistas`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        candidaturaId: candidatura.id,
        empresaUsuarioId: empresa.id,
        vagaId: vaga.id,
        modalidade: 'PRESENCIAL',
        dataInicio: '2026-04-10T14:00:00.000Z',
        dataFim: '2026-04-10T15:00:00.000Z',
        descricao: 'Entrevista presencial pelo detalhe do candidato.',
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

    createdEntrevistas.push(response.body.data.id);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          candidaturaId: candidatura.id,
          modalidade: 'PRESENCIAL',
          meetUrl: null,
          vaga: expect.objectContaining({
            id: vaga.id,
          }),
          empresa: expect.objectContaining({
            id: empresa.id,
            anonima: false,
          }),
          agenda: expect.objectContaining({
            provider: 'INTERNAL_ONLY',
          }),
        }),
      }),
    );

    const interviewsResponse = await request(app)
      .get(`/api/v1/recrutador/candidatos/${candidato.id}/entrevistas?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(interviewsResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: response.body.data.id,
          candidaturaId: candidatura.id,
          modalidade: 'PRESENCIAL',
        }),
      ]),
    );
  });

  it('habilita criação no overview e lista apenas opções elegíveis no escopo misto do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresaAmpla = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `4${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Escopo Amplo',
    });
    const empresaRestrita = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `5${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Escopo Restrito',
    });
    const empresaForaEscopo = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `6${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Fora Escopo',
    });
    const candidatoAmplo = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    const candidatoRestrito = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    const candidatoForaEscopo = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(
      recruiter,
      empresaAmpla,
      empresaRestrita,
      empresaForaEscopo,
      candidatoAmplo,
      candidatoRestrito,
      candidatoForaEscopo,
    );

    const vinculoEmpresa = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresaAmpla.id },
      select: { id: true },
    });
    createdVinculos.push(vinculoEmpresa.id);

    const vagaAmpla = await createVaga({
      empresaUsuarioId: empresaAmpla.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Escopo Amplo',
    });
    const vagaRestrita = await createVaga({
      empresaUsuarioId: empresaRestrita.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Escopo Restrito',
    });
    const vagaForaEscopo = await createVaga({
      empresaUsuarioId: empresaForaEscopo.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora Escopo Dashboard',
    });
    createdVagas.push(vagaAmpla.id, vagaRestrita.id, vagaForaEscopo.id);

    const vinculoVagaRestrita = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaRestrita.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVagaRestrita.id);

    const statusId = await getActiveStatusId();
    const candidaturaAmpla = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaAmpla.id,
        candidatoId: candidatoAmplo.id,
        empresaUsuarioId: empresaAmpla.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaRestrita = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaRestrita.id,
        candidatoId: candidatoRestrito.id,
        empresaUsuarioId: empresaRestrita.id,
        statusId,
      },
      select: { id: true },
    });
    const candidaturaForaEscopo = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaForaEscopo.id,
        candidatoId: candidatoForaEscopo.id,
        empresaUsuarioId: empresaForaEscopo.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaAmpla.id, candidaturaRestrita.id, candidaturaForaEscopo.id);

    const overviewResponse = await request(app)
      .get('/api/v1/recrutador/entrevistas/overview')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(overviewResponse.body.data.capabilities).toEqual(
      expect.objectContaining({
        canCreate: true,
        canCreateOnline: false,
        canCreatePresencial: true,
        requiresGoogleForOnline: true,
      }),
    );

    const empresasResponse = await request(app)
      .get('/api/v1/recrutador/entrevistas/opcoes/empresas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(empresasResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: empresaAmpla.id,
          nomeExibicao: empresaAmpla.nomeCompleto,
          totalVagasElegiveis: 1,
        }),
        expect.objectContaining({
          id: empresaRestrita.id,
          nomeExibicao: empresaRestrita.nomeCompleto,
          totalVagasElegiveis: 1,
        }),
      ]),
    );
    expect(empresasResponse.body.data.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: empresaForaEscopo.id })]),
    );

    const vagasAmplaResponse = await request(app)
      .get(`/api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=${empresaAmpla.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(vagasAmplaResponse.body).toEqual({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            id: vagaAmpla.id,
            empresaUsuarioId: empresaAmpla.id,
            candidatosElegiveis: 1,
          }),
        ],
      },
    });

    const vagasRestritaResponse = await request(app)
      .get(`/api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=${empresaRestrita.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(vagasRestritaResponse.body).toEqual({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            id: vagaRestrita.id,
            empresaUsuarioId: empresaRestrita.id,
            candidatosElegiveis: 1,
          }),
        ],
      },
    });

    const candidatosRestritosResponse = await request(app)
      .get(`/api/v1/recrutador/entrevistas/opcoes/candidatos?vagaId=${vagaRestrita.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(candidatosRestritosResponse.body).toEqual({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            candidaturaId: candidaturaRestrita.id,
            candidato: expect.objectContaining({
              id: candidatoRestrito.id,
              nome: candidatoRestrito.nomeCompleto,
            }),
            entrevistaAtiva: false,
            entrevistaAtivaId: null,
          }),
        ],
      },
    });

    await request(app)
      .get(`/api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=${empresaForaEscopo.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    await request(app)
      .get(`/api/v1/recrutador/entrevistas/opcoes/candidatos?vagaId=${vagaForaEscopo.id}`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);
  }, 60000);

  it('cria entrevista presencial no dashboard do recrutador e bloqueia duplicidade na candidatura', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `7${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Dashboard Recrutador',
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Dashboard Recrutador',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vaga.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();
    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const createResponse = await request(app)
      .post('/api/v1/recrutador/entrevistas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        empresaUsuarioId: empresa.id,
        vagaId: vaga.id,
        candidaturaId: candidatura.id,
        modalidade: 'PRESENCIAL',
        dataInicio: '2026-04-15T14:00:00.000Z',
        dataFim: '2026-04-15T15:00:00.000Z',
        descricao: 'Entrevista presencial criada pelo dashboard do recrutador.',
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
          candidaturaId: candidatura.id,
          modalidade: 'PRESENCIAL',
          vaga: expect.objectContaining({
            id: vaga.id,
          }),
          empresa: expect.objectContaining({
            id: empresa.id,
          }),
          candidato: expect.objectContaining({
            id: candidato.id,
          }),
          agenda: expect.objectContaining({
            provider: 'INTERNAL_ONLY',
          }),
        }),
      }),
    );

    const duplicateResponse = await request(app)
      .post('/api/v1/recrutador/entrevistas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        empresaUsuarioId: empresa.id,
        vagaId: vaga.id,
        candidaturaId: candidatura.id,
        modalidade: 'PRESENCIAL',
        dataInicio: '2026-04-16T14:00:00.000Z',
        dataFim: '2026-04-16T15:00:00.000Z',
        enderecoPresencial: {
          cep: '57084-028',
          logradouro: 'Rua Manoel Pedro de Oliveira',
          numero: '245',
          bairro: 'Benedito Bentes',
          cidade: 'Maceió',
          estado: 'AL',
        },
      })
      .expect(409);

    expect(duplicateResponse.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'INTERVIEW_ALREADY_EXISTS',
      }),
    );
  });

  it('bloqueia criação de entrevista no dashboard quando a candidatura está fora do escopo do recrutador', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: 'Empresa Escopo Bloqueado',
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vagaPermitida = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Permitida',
    });
    const vagaForaEscopo = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Fora do Escopo',
    });
    createdVagas.push(vagaPermitida.id, vagaForaEscopo.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPermitida.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const statusId = await getActiveStatusId();
    const candidaturaForaEscopo = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vagaForaEscopo.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidaturaForaEscopo.id);

    const response = await request(app)
      .post('/api/v1/recrutador/entrevistas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        empresaUsuarioId: empresa.id,
        vagaId: vagaForaEscopo.id,
        candidaturaId: candidaturaForaEscopo.id,
        modalidade: 'PRESENCIAL',
        dataInicio: '2026-04-17T14:00:00.000Z',
        dataFim: '2026-04-17T15:00:00.000Z',
        enderecoPresencial: {
          cep: '57084-028',
          logradouro: 'Rua Manoel Pedro de Oliveira',
          numero: '245',
          bairro: 'Benedito Bentes',
          cidade: 'Maceió',
          estado: 'AL',
        },
      })
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN',
        message: 'Você não possui acesso para criar entrevista nesta candidatura.',
      }),
    );
  });

  it('nega consulta quando status inclui RASCUNHO', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    testUsers.push(recruiter);

    const response = await request(app)
      .get('/api/v1/recrutador/vagas?status=RASCUNHO')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
  });

  it('agenda entrevista e retorna meetUrl', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `2${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Entrevista',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vaga.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const status = (await prisma.statusProcessosCandidatos.findFirst({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })) as StatusProcessosCandidatos | null;

    expect(status).not.toBeNull();

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId: status!.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(now.getTime() + 90 * 60 * 1000);

    const resp = await request(app)
      .post(`/api/v1/recrutador/vagas/${vaga.id}/candidatos/${candidato.id}/entrevistas`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        dataInicio: start.toISOString(),
        dataFim: end.toISOString(),
      })
      .expect(201);

    expect(resp.body).toHaveProperty('success', true);
    expect(resp.body.entrevista).toHaveProperty('meetUrl', 'https://meet.google.com/test-meet');
    expect(resp.body.entrevista).toHaveProperty('meetEventId', 'evt_test_123');

    createdEntrevistas.push(resp.body.entrevista.id);
  });
});
