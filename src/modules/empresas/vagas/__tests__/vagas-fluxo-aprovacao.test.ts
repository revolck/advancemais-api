jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    usuarios: { findUnique: jest.fn() },
    empresasRecursosPremiumVagas: { findUnique: jest.fn() },
    empresasVagasCategorias: { findUnique: jest.fn() },
    empresasVagas: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
jest.mock('@/modules/empresas/clientes/services/clientes.service', () => ({
  clientesService: { findActiveByUsuario: jest.fn() },
}));

import { prisma } from '@/config/prisma';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { vagasService } from '../services/vagas.service';
import { VagasController } from '../controllers/vagas.controller';

const db = prisma as any;
const planoAtivo = clientesService.findActiveByUsuario as jest.Mock;

const EMPRESA = 'empresa-1';
const OUTRA_EMPRESA = 'empresa-2';
const VAGA = 'vaga-1';
const ator = { id: EMPRESA, role: 'EMPRESA' };

const vagaNoBanco = (status: string, candidatos = 0, usuarioId = EMPRESA) => ({
  id: VAGA,
  usuarioId,
  status,
  _count: { EmpresasCandidatos: candidatos },
});

/** Plano de 3 vagas, sem recursos premium, com `emUso` vagas publicadas/em análise */
const cenario = (emUso: number, premium = false) => {
  db.usuarios.findUnique.mockResolvedValue({ tipoUsuario: 'PESSOA_JURIDICA' });
  db.empresasRecursosPremiumVagas.findUnique.mockResolvedValue(
    premium ? { ativo: true, vagasIlimitadas: true, destaquesIlimitados: true } : null,
  );
  planoAtivo.mockResolvedValue({ id: 'plano-1', PlanosEmpresariais: { quantidadeVagas: 3 } });
  db.empresasVagas.count.mockResolvedValue(emUso);
  db.empresasVagas.update.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: VAGA, status: data.status, modoAnonimo: false, Usuarios: null }),
  );
};

/** Vaga válida pelo schema de criação */
const vagaValida = {
  usuarioId: '7d3c1f4e-1111-4a2b-9c3d-000000000001',
  categoriaVagaId: '7d3c1f4e-1111-4a2b-9c3d-000000000002',
  regimeDeTrabalho: 'CLT',
  modalidade: 'PRESENCIAL',
  titulo: 'Atendente',
  jornada: 'INTEGRAL',
  descricao: 'Descrição',
  requisitos: { obrigatorios: ['Ensino médio'] },
  atividades: { principais: ['Atender clientes'] },
  salarioConfidencial: true,
};

beforeEach(() => jest.clearAllMocks());

describe('criar vaga', () => {
  const payload = { ...vagaValida, usuarioId: EMPRESA } as any;

  beforeEach(() => {
    db.empresasVagasCategorias.findUnique.mockResolvedValue({ id: 'cat-1' });
    db.empresasVagas.findUnique.mockResolvedValue(null);
    db.$transaction.mockImplementation((fn: (tx: any) => unknown) => fn(db));
    let criada: any = null;
    db.empresasVagas.create.mockImplementation(({ data }: any) => {
      criada = { id: VAGA, status: data.status, modoAnonimo: false, Usuarios: null };
      return Promise.resolve({ id: VAGA });
    });
    db.empresasVagas.findUniqueOrThrow = jest.fn(() => Promise.resolve(criada));
  });

  it('entra na fila de aprovação (em análise), não como rascunho', async () => {
    cenario(1);
    const vaga: any = await vagasService.create(payload, { actorRole: 'EMPRESA' });
    expect(db.empresasVagas.create.mock.calls[0][0].data.status).toBe('EM_ANALISE');
    expect(vaga.avisoStatus).toBeNull();
  });

  it('plano cheio: salva como rascunho e avisa o motivo', async () => {
    cenario(3);
    const vaga: any = await vagasService.create(payload, { actorRole: 'EMPRESA' });
    expect(db.empresasVagas.create.mock.calls[0][0].data.status).toBe('RASCUNHO');
    expect(vaga.avisoStatus).toMatch(/rascunho/i);
    expect(vaga.avisoStatus).toMatch(/3 vaga/);
  });

  it('o limite conta publicadas e em análise', async () => {
    cenario(0);
    await vagasService.create(payload, { actorRole: 'EMPRESA' });
    expect(db.empresasVagas.count).toHaveBeenCalledWith({
      where: { usuarioId: EMPRESA, status: { in: ['PUBLICADO', 'EM_ANALISE'] } },
    });
  });

  it('recursos premium publicam direto', async () => {
    cenario(10, true);
    await vagasService.create(payload, { actorRole: 'EMPRESA' });
    expect(db.empresasVagas.create.mock.calls[0][0].data.status).toBe('PUBLICADO');
  });
});

describe('enviar para aprovação (botão Publicar da empresa)', () => {
  it('rascunho vai para a fila', async () => {
    cenario(2);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO'));
    const vaga: any = await vagasService.enviarParaAnalise(VAGA, ator);
    expect(vaga.status).toBe('EM_ANALISE');
  });

  it('despublicada também pode voltar para a fila', async () => {
    cenario(0);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('DESPUBLICADA'));
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).resolves.toMatchObject({
      status: 'EM_ANALISE',
    });
  });

  it('plano cheio: recusa com a explicação', async () => {
    cenario(3);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO'));
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toMatchObject({
      code: 'LIMITE_VAGAS_PLANO',
      statusCode: 409,
      limite: 3,
      emUso: 3,
    });
    expect(db.empresasVagas.update).not.toHaveBeenCalled();
  });

  it('já em análise ou publicada: avisa em vez de mudar', async () => {
    cenario(1);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('EM_ANALISE'));
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_JA_EM_ANALISE',
    });
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('PUBLICADO'));
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_JA_PUBLICADA',
    });
  });

  it('empresa não mexe em vaga de outra empresa', async () => {
    cenario(0);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO', 0, OUTRA_EMPRESA));
    await expect(vagasService.enviarParaAnalise(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('despublicar', () => {
  it('publicada vira despublicada; em análise volta a rascunho', async () => {
    cenario(0);
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('PUBLICADO'));
    await expect(vagasService.despublicar(VAGA, ator)).resolves.toMatchObject({
      status: 'DESPUBLICADA',
    });
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('EM_ANALISE'));
    await expect(vagasService.despublicar(VAGA, ator)).resolves.toMatchObject({
      status: 'RASCUNHO',
    });
  });

  it('rascunho não tem o que despublicar', async () => {
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO'));
    await expect(vagasService.despublicar(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_STATUS_INVALIDO',
    });
  });
});

describe('excluir', () => {
  it('não exclui vaga com candidatos', async () => {
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('PUBLICADO', 4));
    await expect(vagasService.removerComRegras(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_COM_CANDIDATOS',
      statusCode: 409,
    });
    expect(db.empresasVagas.delete).not.toHaveBeenCalled();
  });

  it('empresa não exclui vaga de outra empresa', async () => {
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO', 0, OUTRA_EMPRESA));
    await expect(vagasService.removerComRegras(VAGA, ator)).rejects.toMatchObject({
      code: 'VAGA_NOT_FOUND',
    });
    expect(db.empresasVagas.delete).not.toHaveBeenCalled();
  });

  it('admin exclui vaga sem candidatos de qualquer empresa', async () => {
    db.empresasVagas.findUnique.mockResolvedValue(vagaNoBanco('RASCUNHO', 0, OUTRA_EMPRESA));
    await vagasService.removerComRegras(VAGA, { id: 'admin-1', role: 'ADMIN' });
    expect(db.empresasVagas.delete).toHaveBeenCalledWith({ where: { id: VAGA } });
  });
});

describe('controller', () => {
  const res = () =>
    ({ status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() }) as any;

  it('empresa cria a vaga sempre para si mesma, mesmo mandando outro usuarioId', async () => {
    const spy = jest.spyOn(vagasService, 'create').mockResolvedValue({ id: VAGA } as any);
    const req = {
      user: { id: EMPRESA, role: 'EMPRESA' },
      body: vagaValida, // usuarioId de outra conta
    } as any;
    const r = res();
    await VagasController.create(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect((spy.mock.calls[0][0] as any).usuarioId).toBe(EMPRESA);
  });

  it('limite do plano chega ao front como 409 com a mensagem', async () => {
    jest.spyOn(vagasService, 'enviarParaAnalise').mockRejectedValue(
      Object.assign(new Error('Seu plano permite 3 vaga(s)'), {
        code: 'LIMITE_VAGAS_PLANO',
        statusCode: 409,
        limite: 3,
        emUso: 3,
      }),
    );
    const r = res();
    await VagasController.enviarParaAnalise(
      { params: { id: VAGA }, user: { id: EMPRESA, role: 'EMPRESA' } } as any,
      r,
    );
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LIMITE_VAGAS_PLANO', limite: 3, emUso: 3 }),
    );
  });
});
