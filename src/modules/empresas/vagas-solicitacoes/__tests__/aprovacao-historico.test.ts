jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasVagas: { findUnique: jest.fn(), update: jest.fn() },
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
