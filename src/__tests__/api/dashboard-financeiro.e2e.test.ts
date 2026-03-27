import request from 'supertest';
import { Roles } from '@prisma/client';
import type { Express } from 'express';

import { prisma } from '@/config/prisma';
import { createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(40000);

describe('API - Dashboard financeiro', () => {
  const referenceMonth = '2028-03';

  let app: Express;
  const createdUsers: TestUser[] = [];
  const createdTransacaoIds: string[] = [];
  const createdCursoIds: string[] = [];
  const createdPlanoIds: string[] = [];
  const createdEmpresasPlanoIds: string[] = [];

  const registerUser = async (
    overrides: Parameters<typeof createTestUser>[0] = {},
  ): Promise<TestUser> => {
    const user = await createTestUser(overrides);
    createdUsers.push(user);
    return user;
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdTransacaoIds.length > 0) {
      await prisma.auditoriaTransacoes.deleteMany({
        where: { id: { in: createdTransacaoIds } },
      });
    }

    if (createdEmpresasPlanoIds.length > 0) {
      await prisma.empresasPlano.deleteMany({
        where: { id: { in: createdEmpresasPlanoIds } },
      });
    }

    if (createdCursoIds.length > 0) {
      await prisma.cursos.deleteMany({
        where: { id: { in: createdCursoIds } },
      });
    }

    if (createdPlanoIds.length > 0) {
      await prisma.planosEmpresariais.deleteMany({
        where: { id: { in: createdPlanoIds } },
      });
    }

    const userIds = createdUsers.map((user) => user.id);
    if (userIds.length > 0) {
      await prisma.usuariosSessoes.deleteMany({
        where: { usuarioId: { in: userIds } },
      });

      await prisma.usuarios.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  it('ADMIN deve obter dashboard financeiro agregado para o mês selecionado', async () => {
    const admin = await registerUser({
      role: Roles.ADMIN,
      nomeCompleto: 'Admin Financeiro Dashboard',
    });
    const aluno = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Aluno Financeiro Dashboard',
    });
    const empresa = await registerUser({
      role: Roles.EMPRESA,
      nomeCompleto: 'Empresa Financeira Dashboard LTDA',
    });

    const curso = await prisma.cursos.create({
      data: {
        codigo: `F${Date.now().toString().slice(-11)}`,
        nome: 'Curso Dashboard Financeiro Case 1',
        descricao: 'Curso para o dashboard financeiro',
        cargaHoraria: 20,
        statusPadrao: 'PUBLICADO',
        atualizadoEm: new Date(),
      },
    });
    createdCursoIds.push(curso.id);

    const plano = await prisma.planosEmpresariais.create({
      data: {
        icon: 'credit-card',
        nome: 'Plano Dashboard Financeiro Case 1',
        descricao: 'Plano para dashboard financeiro',
        valor: '199.90',
        quantidadeVagas: 20,
      },
    });
    createdPlanoIds.push(plano.id);

    const planoAtivo = await prisma.empresasPlano.create({
      data: {
        usuarioId: empresa.id,
        planosEmpresariaisId: plano.id,
        status: 'ATIVO',
        inicio: new Date('2028-03-10T00:00:00.000Z'),
        criadoEm: new Date('2028-03-10T10:00:00.000Z'),
        atualizadoEm: new Date('2028-03-10T10:00:00.000Z'),
        proximaCobranca: new Date('2028-03-20T10:00:00.000Z'),
      },
    });
    createdEmpresasPlanoIds.push(planoAtivo.id);

    const planoCancelado = await prisma.empresasPlano.create({
      data: {
        usuarioId: empresa.id,
        planosEmpresariaisId: plano.id,
        status: 'CANCELADO',
        inicio: new Date('2028-02-05T00:00:00.000Z'),
        criadoEm: new Date('2028-02-05T10:00:00.000Z'),
        atualizadoEm: new Date('2028-03-18T10:00:00.000Z'),
      },
    });
    createdEmpresasPlanoIds.push(planoCancelado.id);

    const transacoes = await Promise.all([
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'PAGAMENTO',
          status: 'APROVADA',
          valor: 300,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-payment-approved',
          gateway: 'mercado_pago',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-001',
            descricao: 'Compra do curso Dashboard Financeiro Case 1.',
            cursoId: curso.id,
            origem: 'CHECKOUT_CURSO',
            metodoPagamento: 'PIX',
            referenciaExterna: 'fin-ext-001',
          },
          criadoEm: new Date('2028-03-05T10:00:00.000Z'),
          processadoEm: new Date('2028-03-05T10:05:00.000Z'),
        },
      }),
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'ASSINATURA',
          status: 'APROVADA',
          valor: 100,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-subscription-approved',
          gateway: 'stripe',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-002',
            descricao: 'Assinatura do plano Dashboard Financeiro Case 1.',
            planoId: plano.id,
            origem: 'CHECKOUT_ASSINATURA',
            metodoPagamento: 'CARTAO',
            referenciaExterna: 'fin-ext-002',
          },
          criadoEm: new Date('2028-03-12T11:00:00.000Z'),
          processadoEm: new Date('2028-03-12T11:02:00.000Z'),
        },
      }),
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'REEMBOLSO',
          status: 'APROVADA',
          valor: 50,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-refund',
          gateway: 'mercado_pago',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-003',
            descricao: 'Reembolso do curso Dashboard Financeiro Case 1.',
            cursoId: curso.id,
          },
          criadoEm: new Date('2028-03-15T09:00:00.000Z'),
          processadoEm: new Date('2028-03-15T09:10:00.000Z'),
        },
      }),
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'ESTORNO',
          status: 'ESTORNADA',
          valor: 20,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-chargeback',
          gateway: 'manual',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-004',
            descricao: 'Estorno da compra do curso Dashboard Financeiro Case 1.',
          },
          criadoEm: new Date('2028-03-20T08:00:00.000Z'),
          processadoEm: new Date('2028-03-20T08:05:00.000Z'),
        },
      }),
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'PAGAMENTO',
          status: 'PENDENTE',
          valor: 80,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-pending',
          gateway: 'pagarme',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-005',
            descricao: 'Pagamento pendente do curso Dashboard Financeiro Case 1.',
            cursoId: curso.id,
            origem: 'CHECKOUT_CURSO',
          },
          criadoEm: new Date('2028-03-21T13:00:00.000Z'),
        },
      }),
      prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'PAGAMENTO',
          status: 'APROVADA',
          valor: 200,
          moeda: 'BRL',
          referencia: 'DASH_FIN_CASE_1-previous-payment',
          gateway: 'mercado_pago',
          usuarioId: aluno.id,
          empresaId: empresa.id,
          metadata: {
            codigoExibicao: 'FIN-CASE-006',
            descricao: 'Pagamento do período anterior.',
            cursoId: curso.id,
          },
          criadoEm: new Date('2028-02-10T10:00:00.000Z'),
          processadoEm: new Date('2028-02-10T10:02:00.000Z'),
        },
      }),
    ]);

    createdTransacaoIds.push(...transacoes.map((item) => item.id));

    const response = await request(app)
      .get(
        `/api/v1/dashboard/financeiro?mesReferencia=${referenceMonth}&agruparPor=day&ultimasTransacoesLimit=3`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.filtrosAplicados).toEqual({
      periodo: 'month',
      mesReferencia: '2028-03',
      dataInicio: '2028-03-01T00:00:00.000Z',
      dataFim: '2028-03-31T23:59:59.999Z',
      agruparPor: 'day',
      timezone: 'America/Maceio',
    });

    expect(response.body.data.cards).toEqual({
      receitaBruta: expect.objectContaining({
        valor: 400,
        valorFormatado: 'R$ 400,00',
        tendencia: 'up',
      }),
      receitaLiquida: expect.objectContaining({
        valor: 330,
        valorFormatado: 'R$ 330,00',
        tendencia: 'up',
      }),
      ticketMedio: expect.objectContaining({
        valor: 200,
        valorFormatado: 'R$ 200,00',
      }),
      transacoesAprovadas: expect.objectContaining({
        valor: 2,
      }),
      transacoesPendentes: expect.objectContaining({
        valor: 1,
      }),
      estornosEReembolsos: expect.objectContaining({
        valor: 70,
        valorFormatado: 'R$ 70,00',
      }),
    });

    expect(response.body.data.graficos.evolucaoReceita).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '05/03',
          valor: 300,
          valorFormatado: 'R$ 300,00',
          quantidade: 1,
        }),
        expect.objectContaining({
          label: '12/03',
          valor: 100,
          valorFormatado: 'R$ 100,00',
          quantidade: 1,
        }),
      ]),
    );
    expect(response.body.data.graficos.distribuicaoPorGateway).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'MERCADO_PAGO', label: 'Mercado Pago' }),
        expect.objectContaining({ value: 'STRIPE', label: 'Stripe' }),
        expect.objectContaining({ value: 'PAGARME', label: 'Pagar.me' }),
      ]),
    );
    expect(response.body.data.rankings).toEqual({
      topCursos: [expect.objectContaining({ position: 1, name: curso.nome, value: 300 })],
      topPlanos: [expect.objectContaining({ position: 1, name: plano.nome, value: 100 })],
      topEmpresas: [
        expect.objectContaining({ position: 1, name: empresa.nomeCompleto, value: 400 }),
      ],
      topAlunos: [expect.objectContaining({ position: 1, name: aluno.nomeCompleto, value: 400 })],
    });
    expect(response.body.data.assinaturas).toEqual(
      expect.objectContaining({
        ativas: 1,
        novasNoPeriodo: 1,
        canceladasNoPeriodo: 1,
        renovacoesNoPeriodo: 1,
        receitaAssinaturas: 100,
        receitaAssinaturasFormatada: 'R$ 100,00',
      }),
    );
    expect(response.body.data.ultimasTransacoes).toEqual([
      expect.objectContaining({ codigoExibicao: 'FIN-CASE-005', status: 'PENDENTE' }),
      expect.objectContaining({ codigoExibicao: 'FIN-CASE-004', status: 'ESTORNADA' }),
      expect.objectContaining({ codigoExibicao: 'FIN-CASE-003', status: 'APROVADA' }),
    ]);
    expect(response.body.data.acoesRapidas).toEqual({
      detalhesTransacoesUrl: '/dashboard/auditoria/transacoes',
      detalhesAssinaturasUrl: '/dashboard/auditoria/assinaturas',
    });
  });

  it('deve retornar filtros disponíveis para o dashboard financeiro', async () => {
    const admin = await registerUser({
      role: Roles.ADMIN,
      nomeCompleto: 'Admin Filtros Financeiro',
    });

    const response = await request(app)
      .get('/api/v1/dashboard/financeiro/filtros')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.periodos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '7d', label: '7 dias' }),
        expect.objectContaining({ value: 'custom', label: 'Personalizado' }),
      ]),
    );
    expect(response.body.data.agruparPor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'day', label: 'Dia' }),
        expect.objectContaining({ value: 'month', label: 'Mês' }),
      ]),
    );
  });

  it('deve bloquear acesso para MODERADOR', async () => {
    const moderador = await registerUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Moderador Sem Acesso Financeiro',
    });

    const response = await request(app)
      .get('/api/v1/dashboard/financeiro')
      .set('Authorization', `Bearer ${moderador.token}`)
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      code: 'AUDITORIA_ACCESS_DENIED',
      message: 'Sem permissão para acessar os dados de auditoria.',
    });
  });

  it('deve validar filtros inválidos no período customizado', async () => {
    const admin = await registerUser({
      role: Roles.ADMIN,
      nomeCompleto: 'Admin Filtros Inválidos Financeiro',
    });

    const response = await request(app)
      .get(
        '/api/v1/dashboard/financeiro?periodo=custom&dataInicio=2026-03-20T00:00:00.000Z&dataFim=2026-03-01T00:00:00.000Z',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('DASHBOARD_FINANCEIRO_INVALID_FILTERS');
    expect(response.body.message).toBe(
      'Os filtros informados para o dashboard financeiro são inválidos.',
    );
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'dataFim',
          message: 'dataFim deve ser maior ou igual a dataInicio',
        }),
      ]),
    );
  });
});
