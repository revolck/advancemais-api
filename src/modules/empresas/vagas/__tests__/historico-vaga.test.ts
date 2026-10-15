jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasVagas: { findUnique: jest.fn(), findFirst: jest.fn() },
    auditoriaLogs: { findMany: jest.fn() },
    notificacoes: { findMany: jest.fn() },
  },
}));
jest.mock('@/modules/empresas/vagas/services/status-sync.service', () => ({
  syncExpiredPublishedVagas: jest.fn(),
}));

import { prisma } from '@/config/prisma';
import { listarHistoricoDaVaga } from '../services/historico-vaga.service';
import { vagasService } from '../services/vagas.service';

const db = prisma as any;
const EMPRESA = 'empresa-1';
const VAGA = 'vaga-1';

const vaga = {
  id: VAGA,
  usuarioId: EMPRESA,
  inseridaEm: new Date('2026-10-15T11:27:33Z'),
  Usuarios: { nomeCompleto: 'Empresa Teste' },
};
const aprovacao = {
  id: 'log-2',
  acao: 'VAGA_APROVADA',
  descricao: 'Vaga aprovada e publicada pelo setor de vagas',
  dadosAnteriores: { status: 'EM_ANALISE' },
  dadosNovos: { status: 'PUBLICADO' },
  metadata: { observacoes: 'Tudo certo' },
  criadoEm: new Date('2026-10-16T12:00:00Z'),
  Usuarios: { id: 'mod-1', nomeCompleto: 'Fulana Moderadora', role: 'MODERADOR' },
};
const envio = {
  id: 'log-1',
  acao: 'VAGA_ENVIADA_PARA_ANALISE',
  descricao: 'Vaga enviada para aprovação do setor de vagas',
  dadosAnteriores: { status: 'RASCUNHO' },
  dadosNovos: { status: 'EM_ANALISE' },
  metadata: null,
  criadoEm: new Date('2026-10-16T11:00:00Z'),
  Usuarios: { id: EMPRESA, nomeCompleto: 'Empresa Teste', role: 'EMPRESA' },
};

beforeEach(() => {
  jest.clearAllMocks();
  db.empresasVagas.findUnique.mockResolvedValue(vaga);
  db.auditoriaLogs.findMany.mockResolvedValue([aprovacao, envio]);
  db.notificacoes.findMany.mockResolvedValue([]);
});

describe('histórico da vaga', () => {
  it('equipe vê quem aprovou, pelo nome', async () => {
    const h = await listarHistoricoDaVaga(VAGA, { id: 'admin-1', role: 'ADMIN' });
    expect(h[0]).toMatchObject({
      acao: 'VAGA_APROVADA',
      de: 'EM_ANALISE',
      para: 'PUBLICADO',
      autor: { nome: 'Fulana Moderadora', papel: 'MODERADOR' },
      detalhes: { observacoes: 'Tudo certo' },
      origem: 'HISTORICO',
    });
  });

  it('empresa vê o histórico da própria vaga, com a equipe como "Setor de vagas"', async () => {
    const h = await listarHistoricoDaVaga(VAGA, { id: EMPRESA, role: 'EMPRESA' });
    expect(h.find((e) => e.acao === 'VAGA_APROVADA')?.autor).toEqual({
      nome: 'Setor de vagas',
      papel: 'EQUIPE',
    });
    expect(h.find((e) => e.acao === 'VAGA_ENVIADA_PARA_ANALISE')?.autor).toEqual({
      nome: 'Empresa Teste',
      papel: 'EMPRESA',
    });
    expect(JSON.stringify(h)).not.toContain('Fulana');
  });

  it('empresa não vê histórico de vaga de outra empresa', async () => {
    await expect(
      listarHistoricoDaVaga(VAGA, { id: 'outra-empresa', role: 'EMPRESA' }),
    ).rejects.toMatchObject({ code: 'VAGA_NOT_FOUND', statusCode: 404 });
    expect(db.auditoriaLogs.findMany).not.toHaveBeenCalled();
  });

  it('antes do histórico existir: aprovação vem da notificação, sem autor', async () => {
    db.auditoriaLogs.findMany.mockResolvedValue([]);
    db.notificacoes.findMany.mockResolvedValue([
      { id: 'n1', tipo: 'VAGA_APROVADA', criadoEm: new Date('2026-10-15T14:48:38Z'), dados: null },
    ]);
    const h = await listarHistoricoDaVaga(VAGA, { id: 'admin-1', role: 'ADMIN' });
    expect(h.map((e) => [e.acao, e.origem, e.autor])).toEqual([
      ['VAGA_APROVADA', 'NOTIFICACAO', null],
      ['VAGA_CRIADA', 'CADASTRO', null],
    ]);
  });
});

describe('vaga pública não mostra a moderação', () => {
  const linhaVaga = {
    id: VAGA,
    status: 'PUBLICADO',
    modoAnonimo: false,
    Usuarios: null,
    motivoRejeicao: 'interno',
    observacoesAprovacao: 'interno',
    moderadaEm: new Date(),
  };

  it('candidato não recebe motivo de rejeição nem observação da aprovação', async () => {
    db.empresasVagas.findFirst.mockResolvedValue(linhaVaga);
    const publica: any = await vagasService.get(VAGA);
    expect(publica).not.toHaveProperty('motivoRejeicao');
    expect(publica).not.toHaveProperty('observacoesAprovacao');
    expect(publica).not.toHaveProperty('moderadaEm');
  });
});
