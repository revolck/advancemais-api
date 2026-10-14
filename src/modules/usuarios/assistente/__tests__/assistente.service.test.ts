jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasPlano: { findFirst: jest.fn() },
    empresasRecursosPremiumVagas: { findFirst: jest.fn() },
    empresasVagas: { groupBy: jest.fn(), count: jest.fn() },
    empresasCandidatos: { count: jest.fn() },
    empresasVagasEntrevistas: { count: jest.fn(), findFirst: jest.fn() },
    cursosTurmasInscricoes: { findMany: jest.fn(), count: jest.fn() },
    cursosCertificadosEmitidos: { count: jest.fn() },
    usuariosCurriculos: { count: jest.fn() },
    usuarios: { count: jest.fn() },
    cursosTurmas: { count: jest.fn() },
  },
}));
jest.mock('@/modules/instrutor/services/overview.service', () => ({
  instrutorOverviewService: { getOverview: jest.fn() },
}));
jest.mock('@/modules/usuarios/services/recrutador-vagas.service', () => ({
  recrutadorVagasService: { listVagaIds: jest.fn() },
}));

import { prisma } from '@/config/prisma';
import { instrutorOverviewService } from '@/modules/instrutor/services/overview.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { fimDoDiaEmBrasilia, obterContexto } from '../assistente.service';

const db = prisma as any;

describe('contexto do assistente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.empresasVagasEntrevistas.count.mockResolvedValue(0);
    db.empresasVagasEntrevistas.findFirst.mockResolvedValue(null);
  });

  it('empresa com plano ativo: limite, uso de vagas e candidatos novos', async () => {
    db.empresasPlano.findFirst.mockResolvedValue({
      modo: 'TESTE',
      fim: new Date('2026-11-15T02:59:59.999Z'),
      PlanosEmpresariais: { nome: 'Inicial', quantidadeVagas: 3 },
    });
    db.empresasRecursosPremiumVagas.findFirst.mockResolvedValue(null);
    db.empresasVagas.groupBy.mockResolvedValue([
      { status: 'PUBLICADO', _count: { _all: 2 } },
      { status: 'RASCUNHO', _count: { _all: 1 } },
    ]);
    db.empresasCandidatos.count.mockResolvedValue(4);

    const r = await obterContexto({ id: 'e1', role: 'EMPRESA' });
    expect(r).toEqual({
      role: 'EMPRESA',
      empresa: {
        plano: { nome: 'Inicial', modo: 'TESTE', fim: '2026-11-15T02:59:59.999Z', limiteVagas: 3 },
        vagasIlimitadas: false,
        vagas: { publicadas: 2, emAnalise: 0, rascunhos: 1 },
        candidatosNovos7Dias: 4,
        entrevistas: { proximos7Dias: 0, proxima: null },
      },
    });
  });

  it('empresa sem plano: plano null', async () => {
    db.empresasPlano.findFirst.mockResolvedValue(null);
    db.empresasRecursosPremiumVagas.findFirst.mockResolvedValue(null);
    db.empresasVagas.groupBy.mockResolvedValue([]);
    db.empresasCandidatos.count.mockResolvedValue(0);
    const r: any = await obterContexto({ id: 'e1', role: 'EMPRESA' });
    expect(r.empresa.plano).toBeNull();
  });

  it('aluno: cursos em andamento com ids para abrir a aula', async () => {
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([
      { turmaId: 't1', CursosTurmas: { nome: 'Turma A', Cursos: { id: 'c1', nome: 'Excel' } } },
    ]);
    db.cursosTurmasInscricoes.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    db.cursosCertificadosEmitidos.count.mockResolvedValue(2);
    db.usuariosCurriculos.count.mockResolvedValue(0);
    db.empresasCandidatos.count.mockResolvedValue(0);

    const r: any = await obterContexto({ id: 'a1', role: 'ALUNO_CANDIDATO' });
    expect(r.aluno).toMatchObject({
      cursosEmAndamento: [{ cursoId: 'c1', turmaId: 't1', curso: 'Excel', turma: 'Turma A' }],
      inscricoesAguardandoPagamento: 1,
      cursosConcluidos: 2,
      certificados: 2,
      curriculos: 0,
    });
    expect(db.cursosTurmasInscricoes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alunoId: 'a1', statusPagamento: 'APROVADO' }),
      }),
    );
  });

  it('admin: vagas em análise, acessos pendentes e empresas novas', async () => {
    db.empresasVagas.count.mockResolvedValue(5);
    db.usuarios.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    const r: any = await obterContexto({ id: 'adm', role: 'ADMIN' });
    expect(r.equipe).toEqual({ vagasEmAnalise: 5, usuariosPendentes: 7, empresasNovas7Dias: 3 });
  });

  it('recrutador sem vagas vinculadas não conta candidatos', async () => {
    (recrutadorVagasService.listVagaIds as jest.Mock).mockResolvedValue([]);
    const r: any = await obterContexto({ id: 'rec', role: 'RECRUTADOR' });
    expect(r.equipe).toMatchObject({ vagasVinculadas: 0, candidatosNovos7Dias: 0 });
    expect(db.empresasCandidatos.count).not.toHaveBeenCalled();
  });

  it('instrutor usa o resumo que o painel dele já calcula', async () => {
    (instrutorOverviewService.getOverview as jest.Mock).mockResolvedValue({
      metricasGerais: { totalTurmas: 2 },
      cards: { aulas: { hoje: 1 }, provas: { pendentesCorrecao: 4 }, notas: { pendentes: 6 } },
    });
    const r: any = await obterContexto({ id: 'ins', role: 'INSTRUTOR' });
    expect(r.equipe).toEqual({ turmas: 2, aulasHoje: 1, provasParaCorrigir: 4, notasPendentes: 6 });
  });

  it('se a consulta falhar, o bloco vem null e o assistente segue com a ajuda', async () => {
    db.empresasVagas.count.mockRejectedValue(new Error('banco fora'));
    db.usuarios.count.mockResolvedValue(0);
    await expect(obterContexto({ id: 'adm', role: 'MODERADOR' })).resolves.toEqual({
      role: 'MODERADOR',
      equipe: null,
    });
  });

  it('fim do dia é meia-noite de Brasília', () => {
    expect(fimDoDiaEmBrasilia(new Date('2026-10-14T23:30:00Z')).toISOString()).toBe(
      '2026-10-15T03:00:00.000Z',
    );
    expect(fimDoDiaEmBrasilia(new Date('2026-10-15T02:30:00Z')).toISOString()).toBe(
      '2026-10-15T03:00:00.000Z',
    );
  });
});
