jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    usuarios: { findUnique: jest.fn() },
    empresasRecursosPremiumVagas: { findUnique: jest.fn() },
    empresasVagasCategorias: { findUnique: jest.fn() },
    empresasVagas: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditoriaLogs: { create: jest.fn() },
    notificacoes: { create: jest.fn(), findFirst: jest.fn() },
  },
}));
jest.mock('@/modules/empresas/clientes/services/clientes.service', () => ({
  clientesService: { findActiveByUsuario: jest.fn() },
}));

import { prisma } from '@/config/prisma';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { vagasService } from '../services/vagas.service';
import { syncExpiredPublishedVagas } from '../services/status-sync.service';

const db = prisma as any;
const EMPRESA = 'empresa-1';
const VAGA = 'vaga-1';
const ator = { id: EMPRESA, role: 'EMPRESA' };

const vagaValida = {
  usuarioId: EMPRESA,
  categoriaVagaId: '7d3c1f4e-1111-4a2b-9c3d-000000000002',
  regimeDeTrabalho: 'CLT',
  modalidade: 'PRESENCIAL',
  titulo: 'Analista fiscal',
  jornada: 'INTEGRAL',
  descricao: 'Descrição',
  requisitos: { obrigatorios: ['Ensino médio'] },
  atividades: { principais: ['Atender clientes'] },
  salarioConfidencial: true,
} as any;

/** Plano de 3 vagas com `emUso` ocupadas */
const plano = (emUso: number) => {
  db.usuarios.findUnique.mockResolvedValue({ tipoUsuario: 'PESSOA_JURIDICA' });
  db.empresasRecursosPremiumVagas.findUnique.mockResolvedValue(null);
  (clientesService.findActiveByUsuario as jest.Mock).mockResolvedValue({
    id: 'p1',
    PlanosEmpresariais: { quantidadeVagas: 3 },
  });
  db.empresasVagas.count.mockResolvedValue(emUso);
};

const avisos = () => db.notificacoes.create.mock.calls.map((c: any) => c[0].data);

beforeEach(() => {
  jest.clearAllMocks();
  db.notificacoes.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation((fn: (tx: any) => unknown) => fn(db));
  db.empresasVagasCategorias.findUnique.mockResolvedValue({ id: 'cat' });
  let criada: any = null;
  db.empresasVagas.create.mockImplementation(({ data }: any) => {
    criada = {
      id: VAGA,
      usuarioId: EMPRESA,
      titulo: data.titulo,
      status: data.status,
      Usuarios: null,
    };
    return Promise.resolve({ id: VAGA });
  });
  db.empresasVagas.findUniqueOrThrow = jest.fn(() => Promise.resolve(criada));
});

describe('avisos para a empresa', () => {
  it('cadastrou: vaga enviada para aprovação', async () => {
    plano(0);
    db.empresasVagas.findUnique.mockResolvedValue(null);
    await vagasService.create(vagaValida, { actorRole: 'EMPRESA', actorId: EMPRESA });
    expect(avisos()).toEqual([
      expect.objectContaining({
        usuarioId: EMPRESA,
        vagaId: VAGA,
        tipo: 'VAGA_EM_ANALISE',
        linkAcao: `/dashboard/empresas/vagas/${VAGA}`,
      }),
    ]);
  });

  it('cadastrou com o plano cheio: aviso de limite, com link para os planos', async () => {
    plano(3);
    db.empresasVagas.findUnique.mockResolvedValue(null);
    await vagasService.create(vagaValida, { actorRole: 'EMPRESA', actorId: EMPRESA });
    expect(avisos()).toEqual([
      expect.objectContaining({
        tipo: 'VAGA_LIMITE_PLANO',
        linkAcao: '/dashboard/upgrade',
        prioridade: 'ALTA',
      }),
    ]);
  });

  it('a vaga ocupou a última vaga do plano: avisa que o plano está completo', async () => {
    plano(2);
    db.empresasVagas.findUnique.mockResolvedValue(null);
    await vagasService.create(vagaValida, { actorRole: 'EMPRESA', actorId: EMPRESA });
    expect(avisos().map((a: any) => a.tipo)).toEqual(['VAGA_EM_ANALISE', 'VAGA_LIMITE_PLANO']);
    expect(avisos()[1].titulo).toBe('Você usou todas as vagas do plano');
  });

  it('envio recusado pelo limite avisa, mas não repete enquanto o aviso não for lido', async () => {
    plano(3);
    db.empresasVagas.findUnique.mockResolvedValue({
      id: VAGA,
      usuarioId: EMPRESA,
      titulo: 'Analista fiscal',
      status: 'RASCUNHO',
      _count: { EmpresasCandidatos: 0 },
    });
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toMatchObject({
      code: 'LIMITE_VAGAS_PLANO',
    });
    expect(avisos()).toHaveLength(1);

    db.notificacoes.findFirst.mockResolvedValue({ id: 'ja-avisado' });
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toBeDefined();
    expect(avisos()).toHaveLength(1);
  });

  it('despublicada pelo setor de vagas: aviso com prioridade alta', async () => {
    db.empresasVagas.findUnique.mockResolvedValue({
      id: VAGA,
      usuarioId: EMPRESA,
      titulo: 'Analista fiscal',
      status: 'PUBLICADO',
      _count: { EmpresasCandidatos: 0 },
    });
    db.empresasVagas.update.mockResolvedValue({ id: VAGA, status: 'DESPUBLICADA', Usuarios: null });
    await vagasService.despublicar(VAGA, { id: 'setor-1', role: 'SETOR_DE_VAGAS' });
    expect(avisos()).toEqual([
      expect.objectContaining({ tipo: 'VAGA_DESPUBLICADA', prioridade: 'ALTA' }),
    ]);
  });

  it('empresa cancelando o próprio envio não gera aviso', async () => {
    db.empresasVagas.findUnique.mockResolvedValue({
      id: VAGA,
      usuarioId: EMPRESA,
      titulo: 'Analista fiscal',
      status: 'EM_ANALISE',
      _count: { EmpresasCandidatos: 0 },
    });
    db.empresasVagas.update.mockResolvedValue({ id: VAGA, status: 'RASCUNHO', Usuarios: null });
    await vagasService.despublicar(VAGA, ator);
    expect(avisos()).toEqual([]);
  });

  it('se a notificação falhar, a ação continua valendo', async () => {
    plano(0);
    db.empresasVagas.findUnique.mockResolvedValue(null);
    db.notificacoes.create.mockRejectedValueOnce(new Error('banco fora'));
    await expect(
      vagasService.create(vagaValida, { actorRole: 'EMPRESA', actorId: EMPRESA }),
    ).resolves.toMatchObject({ id: VAGA, status: 'EM_ANALISE' });
  });
});

describe('expiração automática', () => {
  it('avisa e registra no histórico cada vaga que expirou', async () => {
    db.empresasVagas.findMany.mockResolvedValue([
      { id: 'v1', usuarioId: EMPRESA, titulo: 'Faturista' },
      { id: 'v2', usuarioId: EMPRESA, titulo: 'Eletricista' },
    ]);
    db.empresasVagas.updateMany.mockResolvedValue({ count: 1 });
    await expect(syncExpiredPublishedVagas()).resolves.toEqual({ count: 2 });
    expect(avisos().map((a: any) => [a.tipo, a.vagaId])).toEqual([
      ['VAGA_EXPIRADA', 'v1'],
      ['VAGA_EXPIRADA', 'v2'],
    ]);
    expect(db.auditoriaLogs.create).toHaveBeenCalledTimes(2);
  });

  it('vaga que outra execução já expirou não é avisada de novo', async () => {
    db.empresasVagas.findMany.mockResolvedValue([
      { id: 'v1', usuarioId: EMPRESA, titulo: 'Faturista' },
    ]);
    db.empresasVagas.updateMany.mockResolvedValue({ count: 0 });
    await expect(syncExpiredPublishedVagas()).resolves.toEqual({ count: 0 });
    expect(avisos()).toEqual([]);
  });
});
