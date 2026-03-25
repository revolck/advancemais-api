import request from 'supertest';
import { Roles } from '@prisma/client';
import type { Express } from 'express';

import { prisma } from '@/config/prisma';
import { createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(40000);

describe('API - Auditoria de transações dashboard', () => {
  let app: Express;
  const createdUsers: TestUser[] = [];
  const createdTransacaoIds: string[] = [];
  const createdCursoIds: string[] = [];
  const createdPlanoIds: string[] = [];

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

  it('ADMIN deve listar transações com payload amigável para o dashboard', async () => {
    const admin = await registerUser({
      role: Roles.ADMIN,
      nomeCompleto: 'Maria Admin Auditoria TX',
    });
    const aluno = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'João Comprador Dashboard TX',
    });
    const empresa = await registerUser({
      role: Roles.EMPRESA,
      nomeCompleto: 'Empresa Dashboard Pagamentos LTDA',
    });

    const curso = await prisma.cursos.create({
      data: {
        codigo: `C${Date.now().toString().slice(-11)}`,
        nome: 'UX/UI Design AUD_TRANS_DASH_CASE_1',
        descricao: 'Curso para auditoria de transações',
        cargaHoraria: 12,
        statusPadrao: 'PUBLICADO',
        atualizadoEm: new Date(),
      },
    });
    createdCursoIds.push(curso.id);

    const plano = await prisma.planosEmpresariais.create({
      data: {
        icon: 'briefcase',
        nome: 'Plano Growth AUD_TRANS_DASH_CASE_1',
        descricao: 'Plano para teste de auditoria',
        valor: '149.90',
        quantidadeVagas: 10,
      },
    });
    createdPlanoIds.push(plano.id);

    const pagamento = await prisma.auditoriaTransacoes.create({
      data: {
        tipo: 'PAGAMENTO',
        status: 'APROVADA',
        valor: 299.9,
        moeda: 'BRL',
        referencia: 'AUD_TRANS_DASH_CASE_1-checkout-curso',
        gateway: 'mercado_pago',
        gatewayId: 'mp-123456',
        usuarioId: aluno.id,
        empresaId: empresa.id,
        metadata: {
          descricao: 'Compra do curso UX/UI Design AUD_TRANS_DASH_CASE_1.',
          cursoId: curso.id,
          origem: 'CHECKOUT_CURSO',
          metodoPagamento: 'PIX',
          referenciaExterna: 'ext-001',
          gatewayStatus: 'approved',
        },
        criadoEm: new Date('2026-03-25T10:40:00.000Z'),
        processadoEm: new Date('2026-03-25T10:41:00.000Z'),
      },
    });
    createdTransacaoIds.push(pagamento.id);

    const assinatura = await prisma.auditoriaTransacoes.create({
      data: {
        tipo: 'ASSINATURA',
        status: 'PENDENTE',
        valor: 149.9,
        moeda: 'BRL',
        referencia: 'AUD_TRANS_DASH_CASE_1-assinatura-plano',
        gateway: 'stripe',
        gatewayId: 'sub-987654',
        usuarioId: aluno.id,
        empresaId: empresa.id,
        metadata: {
          planoId: plano.id,
          origem: 'CHECKOUT_ASSINATURA',
          metodoPagamento: 'CARTAO',
          externalRef: 'ext-002',
        },
        criadoEm: new Date('2026-03-25T11:00:00.000Z'),
      },
    });
    createdTransacaoIds.push(assinatura.id);

    const response = await request(app)
      .get('/api/v1/auditoria/transacoes?page=1&pageSize=10&search=AUD_TRANS_DASH_CASE_1')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data.resumo).toEqual(
      expect.objectContaining({
        total: 2,
        valorTotal: 449.8,
        ultimoEventoEm: '2026-03-25T11:00:00.000Z',
      }),
    );

    const paymentItem = response.body.data.items.find((item: any) => item.tipo === 'PAGAMENTO');

    expect(paymentItem).toEqual(
      expect.objectContaining({
        codigoExibicao: expect.stringMatching(/^PGTO-/),
        tipo: 'PAGAMENTO',
        tipoLabel: 'Pagamento',
        status: 'APROVADA',
        statusLabel: 'Aprovada',
        valor: 299.9,
        valorFormatado: 'R$ 299,90',
        gateway: 'MERCADO_PAGO',
        gatewayLabel: 'Mercado Pago',
        gatewayReferencia: 'ext-001',
        descricao: 'Compra do curso UX/UI Design AUD_TRANS_DASH_CASE_1.',
        usuario: expect.objectContaining({
          id: aluno.id,
          nome: aluno.nomeCompleto,
          email: aluno.email,
          codigo: expect.any(String),
        }),
        empresa: expect.objectContaining({
          id: empresa.id,
          nomeExibicao: empresa.nomeCompleto,
          codigo: expect.any(String),
        }),
        contexto: expect.objectContaining({
          cursoId: curso.id,
          cursoNome: curso.nome,
          origem: 'CHECKOUT_CURSO',
          metodoPagamento: 'PIX',
        }),
        meta: expect.objectContaining({
          gatewayStatus: 'approved',
          referenciaExterna: 'ext-001',
        }),
        criadoEm: '2026-03-25T10:40:00.000Z',
        atualizadoEm: '2026-03-25T10:41:00.000Z',
      }),
    );

    expect(response.body.data.filtrosDisponiveis.tipos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'PAGAMENTO', label: 'Pagamento', count: 1 }),
        expect.objectContaining({ value: 'ASSINATURA', label: 'Assinatura', count: 1 }),
      ]),
    );
    expect(response.body.data.filtrosDisponiveis.status).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'APROVADA', label: 'Aprovada', count: 1 }),
        expect.objectContaining({ value: 'PENDENTE', label: 'Pendente', count: 1 }),
      ]),
    );
    expect(response.body.data.filtrosDisponiveis.gateways).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'MERCADO_PAGO', label: 'Mercado Pago', count: 1 }),
        expect.objectContaining({ value: 'STRIPE', label: 'Stripe', count: 1 }),
      ]),
    );
  });

  it('ADMIN deve conseguir buscar por curso e filtrar por tipo/status', async () => {
    const admin = await registerUser({ role: Roles.ADMIN, nomeCompleto: 'Admin Busca TX' });
    const aluno = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'Aluno Busca TX',
    });

    const curso = await prisma.cursos.create({
      data: {
        codigo: `B${Date.now().toString().slice(-11)}`,
        nome: 'Curso Busca Auditoria Transações 2',
        descricao: 'Curso para busca de auditoria',
        cargaHoraria: 8,
        statusPadrao: 'PUBLICADO',
        atualizadoEm: new Date(),
      },
    });
    createdCursoIds.push(curso.id);

    const transacao = await prisma.auditoriaTransacoes.create({
      data: {
        tipo: 'PAGAMENTO',
        status: 'APROVADA',
        valor: 89.9,
        moeda: 'BRL',
        referencia: 'busca-course-payment',
        gateway: 'mercadopago',
        usuarioId: aluno.id,
        metadata: {
          cursoId: curso.id,
          origem: 'CHECKOUT_CURSO',
          metodoPagamento: 'PIX',
        },
        criadoEm: new Date('2026-03-25T12:00:00.000Z'),
      },
    });
    createdTransacaoIds.push(transacao.id);

    const response = await request(app)
      .get(
        `/api/v1/auditoria/transacoes?search=${encodeURIComponent(
          'Curso Busca Auditoria Transações 2',
        )}&tipos=PAGAMENTO&status=APROVADA`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        tipo: 'PAGAMENTO',
        status: 'APROVADA',
        contexto: expect.objectContaining({
          cursoId: curso.id,
          cursoNome: curso.nome,
        }),
      }),
    );
  });

  it('MODERADOR não deve acessar a auditoria de transações', async () => {
    const moderador = await registerUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Carlos Moderador',
    });

    const response = await request(app)
      .get('/api/v1/auditoria/transacoes')
      .set('Authorization', `Bearer ${moderador.token}`)
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      code: 'AUDITORIA_ACCESS_DENIED',
      message: 'Sem permissão para acessar os dados de auditoria.',
    });
  });

  it('deve rejeitar filtros inválidos na auditoria de transações', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });

    const response = await request(app)
      .get(
        '/api/v1/auditoria/transacoes?dataInicio=2026-03-31T00:00:00.000Z&dataFim=2026-03-01T00:00:00.000Z',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('AUDITORIA_INVALID_FILTERS');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'dataFim' })]),
    );
  });
});
