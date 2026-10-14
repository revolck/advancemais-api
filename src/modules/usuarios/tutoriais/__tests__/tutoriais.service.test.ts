const mockFindMany = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuariosTutoriais: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      upsert: (...a: unknown[]) => mockUpsert(...a),
    },
  },
}));

import { CHAVE_TUTORIAL, listarTutoriais, registrarTutorial } from '../tutoriais.service';

const em = new Date('2026-10-14T18:00:00Z');

beforeEach(() => jest.clearAllMocks());

describe('tutoriais do assistente', () => {
  it('lista por chave só do usuário logado', async () => {
    mockFindMany.mockResolvedValue([
      { chave: 'EMPRESA_PRIMEIRO_ACESSO_V1', status: 'CONCLUIDO', atualizadoEm: em },
    ]);
    expect(await listarTutoriais('u1')).toEqual({
      EMPRESA_PRIMEIRO_ACESSO_V1: { status: 'CONCLUIDO', em: em.toISOString() },
    });
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ usuarioId: 'u1' });
  });

  it('registrar é idempotente (upsert por usuário + chave)', async () => {
    mockUpsert.mockResolvedValue({ chave: 'X_TOUR', status: 'PULADO', atualizadoEm: em });
    await registrarTutorial('u1', 'X_TOUR', 'PULADO');
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({
      where: { usuarioId_chave: { usuarioId: 'u1', chave: 'X_TOUR' } },
      create: { usuarioId: 'u1', chave: 'X_TOUR', status: 'PULADO' },
      update: { status: 'PULADO' },
    });
  });

  it('só aceita chaves no formato combinado', () => {
    expect(CHAVE_TUTORIAL.test('EMPRESA_PRIMEIRO_ACESSO_V1')).toBe(true);
    expect(CHAVE_TUTORIAL.test('empresa')).toBe(false);
    expect(CHAVE_TUTORIAL.test('A')).toBe(false);
    expect(CHAVE_TUTORIAL.test('X; DROP')).toBe(false);
  });
});
