jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasVagas: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    auditoriaLogs: { create: jest.fn() },
  },
}));
jest.mock('@/modules/empresas/admin/services/admin-empresas.service', () => ({
  adminEmpresasService: { approveVaga: jest.fn() },
}));
jest.mock('@/modules/empresas/admin/services/admin-vagas.service', () => ({
  adminVagasService: {},
}));
jest.mock('@/modules/notificacoes/services/notificacoes.service', () => ({
  notificacoesService: {
    notificarVagaAprovada: jest.fn(),
    notificarVagaRejeitada: jest.fn(),
  },
}));

import { prisma } from '@/config/prisma';
import { solicitacoesService } from '../services/solicitacoes.service';

const db = prisma as any;
const VAGA = {
  id: 'vaga-1',
  usuarioId: 'empresa-1',
  titulo: 'Analista fiscal',
  status: 'EM_ANALISE',
};

beforeEach(() => {
  jest.clearAllMocks();
  db.empresasVagas.findUnique.mockResolvedValue(VAGA);
});

describe('histórico da aprovação', () => {
  it('registra quem aprovou', async () => {
    await solicitacoesService.aprovar(VAGA.id, {} as any, 'moderador-1');
    expect(db.auditoriaLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'VAGA_APROVADA',
        usuarioId: 'moderador-1',
        entidadeId: VAGA.id,
        entidadeTipo: 'VAGA',
        dadosAnteriores: { status: 'EM_ANALISE' },
        dadosNovos: { status: 'PUBLICADO' },
      }),
    });
  });

  it('registra quem rejeitou e o motivo', async () => {
    await solicitacoesService.rejeitar(
      VAGA.id,
      { motivoRejeicao: 'Salário fora da faixa informada' } as any,
      'setor-1',
    );
    expect(db.auditoriaLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'VAGA_REJEITADA',
        usuarioId: 'setor-1',
        metadata: { motivoRejeicao: 'Salário fora da faixa informada' },
      }),
    });
  });

  it('se o histórico falhar, a aprovação não é desfeita', async () => {
    db.auditoriaLogs.create.mockRejectedValueOnce(new Error('banco fora'));
    await expect(
      solicitacoesService.aprovar(VAGA.id, {} as any, 'moderador-1'),
    ).resolves.toMatchObject({ success: true });
  });
});

describe('rejeição e aprovação não mexem nas observações da empresa', () => {
  it('rejeitar grava o motivo no campo próprio', async () => {
    await solicitacoesService.rejeitar(
      VAGA.id,
      { motivoRejeicao: ' Salário fora da faixa ' } as any,
      'setor-1',
    );
    const data = db.empresasVagas.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'RASCUNHO', motivoRejeicao: 'Salário fora da faixa' });
    expect(data.moderadaEm).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty('observacoes');
  });

  it('aprovar com observação grava no campo da moderação', async () => {
    await solicitacoesService.aprovar(VAGA.id, { observacoes: 'Ok' } as any, 'moderador-1');
    const data = db.empresasVagas.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ observacoesAprovacao: 'Ok', motivoRejeicao: null });
    expect(data).not.toHaveProperty('observacoes');
  });
});

describe('situação das solicitações', () => {
  const linha = (status: string, extra: Record<string, unknown> = {}) => ({
    id: `v-${status}`,
    codigo: 'ABC123',
    titulo: 'Vaga',
    status,
    inseridaEm: new Date('2026-10-15T10:00:00Z'),
    atualizadoEm: new Date('2026-10-15T12:00:00Z'),
    motivoRejeicao: null,
    observacoesAprovacao: null,
    moderadaEm: null,
    Usuarios: { id: 'e1', nomeCompleto: 'Empresa', codUsuario: 'E1', cnpj: null },
    ...extra,
  });

  const listar = async (linhas: any[], status?: string[]) => {
    db.empresasVagas.findMany.mockResolvedValue(linhas);
    db.empresasVagas.count.mockResolvedValue(linhas.length);
    return solicitacoesService.list({ page: 1, pageSize: 10, status } as any);
  };

  it('rascunho com observação da empresa não aparece como rejeitada', async () => {
    const { data } = await listar([linha('RASCUNHO', { observacoes: 'Texto da empresa' })]);
    expect(data[0].status).toBe('CANCELADA');
    expect(data[0].motivoRejeicao).toBeNull();
  });

  it('rejeitada = rascunho com motivo de rejeição', async () => {
    const moderadaEm = new Date('2026-10-15T13:00:00Z');
    const { data } = await listar([
      linha('RASCUNHO', { motivoRejeicao: 'Faltou salário', moderadaEm }),
    ]);
    expect(data[0]).toMatchObject({
      status: 'REJEITADA',
      motivoRejeicao: 'Faltou salário',
      dataResposta: moderadaEm.toISOString(),
    });
  });

  it('vaga despublicada ou encerrada passou pela aprovação: não é "rejeitada"', async () => {
    const { data } = await listar([linha('DESPUBLICADA'), linha('ENCERRADA')]);
    expect(data.map((d: any) => d.status)).toEqual(['APROVADA', 'APROVADA']);
  });

  it('filtro "rejeitada" busca rascunhos com motivo', async () => {
    await listar([], ['REJEITADA']);
    const where = db.empresasVagas.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      OR: [{ status: 'RASCUNHO', motivoRejeicao: { not: null } }],
    });
  });

  it('observação da aprovação vem do campo próprio', async () => {
    const { data } = await listar([
      linha('PUBLICADO', { observacoesAprovacao: 'Aprovada', observacoes: 'Da empresa' }),
    ]);
    expect(data[0].observacoes).toBe('Aprovada');
  });
});
