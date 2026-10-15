jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    cursosTurmas: { findFirst: jest.fn() },
    usuarios: { findMany: jest.fn() },
    usuariosInformation: { findUnique: jest.fn(), update: jest.fn() },
    cursosTurmasInscricoes: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    cursosCertificadosEmitidos: { findMany: jest.fn(), updateMany: jest.fn() },
    cursosCertificadosLogs: { createMany: jest.fn() },
    auditoriaLogs: { create: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/utils/cache', () => ({
  invalidateCacheByPrefix: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/code-generator', () => ({
  generateUniqueInscricaoCode: jest.fn().mockResolvedValue('INS-1'),
}));
jest.mock('../services/turmas.service', () => ({
  createLateEnrollmentAccessRecords: jest.fn(),
}));
jest.mock('@/modules/notificacoes/services/notificacoes.service', () => ({
  notificacoesService: { criar: jest.fn().mockResolvedValue({ id: 'n1' }) },
}));
const sendGeneric = jest.fn().mockResolvedValue({ success: true });
jest.mock('@/modules/email/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({ sendGeneric })),
}));
jest.mock('@/modules/email/config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getRuntimeConfig: async () => ({ urls: { frontend: 'https://advancemais.com' } }),
    }),
  },
}));

import { prisma } from '@/config/prisma';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { createLateEnrollmentAccessRecords } from '../services/turmas.service';
import { adicionarAlunos, removerAlunos } from '../services/inscricoes-equipe.service';

const db = prisma as any;
const ator = { id: 'ped-1', role: 'PEDAGOGICO' };
const CURSO = 'curso-1';
const TURMA = 'turma-1';

const turma = (extra: Record<string, unknown> = {}) => ({
  id: TURMA,
  nome: 'Turma Fiscal',
  codigo: 'T1',
  status: 'EM_ANDAMENTO',
  vagasTotais: 3,
  vagasIlimitadas: false,
  dataInicio: new Date('2026-09-01T12:00:00Z'),
  dataFim: new Date('2026-12-01T12:00:00Z'),
  dataInscricaoFim: new Date('2026-08-30T12:00:00Z'),
  Cursos: { id: CURSO, nome: 'Analista Fiscal', valor: 300, gratuito: false },
  ...extra,
});
const aluno = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  nomeCompleto: `Aluno ${id}`,
  email: `${id}@teste.com`,
  role: 'ALUNO_CANDIDATO',
  status: 'ATIVO',
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: any) => unknown) => fn(db));
  db.cursosTurmas.findFirst.mockResolvedValue(turma());
  db.usuariosInformation.findUnique.mockResolvedValue({ inscricao: 'JA-TEM' });
  db.cursosTurmasInscricoes.count.mockResolvedValue(2);
  db.cursosTurmasInscricoes.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: `ins-${data.alunoId}` }),
  );
  db.cursosCertificadosEmitidos.findMany.mockResolvedValue([]);
});

/** findMany 1: inscrições do aluno nesta turma; 2: em outras turmas do curso */
const inscricoesExistentes = (nestaTurma: any[], outras: any[] = []) =>
  db.cursosTurmasInscricoes.findMany
    .mockResolvedValueOnce(nestaTurma)
    .mockResolvedValueOnce(outras);

describe('adicionar alunos: prévia', () => {
  it('separa quem entra, quem volta, quem já está e quem não pode', async () => {
    db.usuarios.findMany.mockResolvedValue([
      aluno('a1'),
      aluno('a2'),
      aluno('a3'),
      aluno('emp', { role: 'EMPRESA' }),
      aluno('blq', { status: 'BLOQUEADO' }),
    ]);
    inscricoesExistentes(
      [
        {
          id: 'i2',
          alunoId: 'a2',
          status: 'CANCELADO',
          statusPagamento: 'APROVADO',
          removidaEm: new Date(),
          statusAntesRemocao: 'INSCRITO',
        },
        {
          id: 'i3',
          alunoId: 'a3',
          status: 'INSCRITO',
          statusPagamento: 'APROVADO',
          removidaEm: null,
          statusAntesRemocao: null,
        },
      ],
      [{ alunoId: 'a1', CursosTurmas: { nome: 'Turma antiga' } }],
    );

    const r: any = await adicionarAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        alunoIds: ['a1', 'a2', 'a3', 'emp', 'blq', 'sumiu'],
        motivo: 'Regularização da turma migrada',
        pagamento: 'CONCEDIDO',
        simular: true,
      },
      ator,
    );

    expect(r.aplicado).toBe(false);
    expect(r.adicionar.map((a: any) => a.alunoId)).toEqual(['a1']);
    expect(r.reativar.map((a: any) => a.alunoId)).toEqual(['a2']);
    expect(r.jaNaTurma.map((a: any) => a.alunoId)).toEqual(['a3']);
    expect(r.recusados.map((a: any) => a.alunoId)).toEqual(['emp', 'blq', 'sumiu']);
    expect(r.avisos).toMatchObject({
      turmaIniciada: true,
      prazoDeInscricaoEncerrado: true,
      excedeVagas: true, // 2 ocupadas + 2 entrando > 3
      outrasTurmasDoCurso: [{ alunoId: 'a1', turma: 'Turma antiga' }],
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('turma cancelada não recebe alunos', async () => {
    db.cursosTurmas.findFirst.mockResolvedValue(turma({ status: 'CANCELADO' }));
    await expect(
      adicionarAlunos(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          alunoIds: ['a1'],
          motivo: 'teste x',
          pagamento: 'CONCEDIDO',
        },
        ator,
      ),
    ).rejects.toMatchObject({ code: 'TURMA_CANCELADA', statusCode: 409 });
  });

  it('cobrança pendente em turma concluída é recusada (o site não vende turma concluída)', async () => {
    db.cursosTurmas.findFirst.mockResolvedValue(turma({ status: 'CONCLUIDO' }));
    await expect(
      adicionarAlunos(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          alunoIds: ['a1'],
          motivo: 'teste x',
          pagamento: 'COBRANCA_PENDENTE',
        },
        ator,
      ),
    ).rejects.toMatchObject({ code: 'COBRANCA_INDISPONIVEL' });
  });

  it('cobrança pendente em curso gratuito é recusada (não há o que pagar)', async () => {
    db.cursosTurmas.findFirst.mockResolvedValue({
      ...turma(),
      Cursos: { id: CURSO, nome: 'Analista Fiscal', valor: 0, gratuito: true },
    });
    await expect(
      adicionarAlunos(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          alunoIds: ['a1'],
          motivo: 'teste x',
          pagamento: 'COBRANCA_PENDENTE',
          simular: true,
        },
        ator,
      ),
    ).rejects.toMatchObject({ code: 'COBRANCA_INDISPONIVEL', statusCode: 409 });
  });
});

describe('adicionar alunos: aplicar', () => {
  beforeEach(() => {
    db.usuarios.findMany.mockResolvedValue([aluno('a1')]);
    inscricoesExistentes([]);
  });

  it('concedido pela equipe: acesso liberado, origem e auditoria com o aluno', async () => {
    const r: any = await adicionarAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        alunoIds: ['a1'],
        motivo: 'Aluno da turma migrada',
        pagamento: 'CONCEDIDO',
      },
      ator,
    );
    expect(r.aplicado).toBe(true);
    expect(db.cursosTurmasInscricoes.create.mock.calls[0][0].data).toMatchObject({
      turmaId: TURMA,
      alunoId: 'a1',
      origem: 'EQUIPE',
      adicionadaPorId: 'ped-1',
      status: 'INSCRITO',
      statusPagamento: 'APROVADO',
      metodoPagamento: 'ADMINISTRATIVO',
      valorPago: 0,
    });
    // turma em andamento: libera aulas e provas já passadas
    expect(createLateEnrollmentAccessRecords).toHaveBeenCalled();
    expect(db.auditoriaLogs.create.mock.calls[0][0].data).toMatchObject({
      acao: 'INSCRICAO_ADICIONADA_PELA_EQUIPE',
      entidadeTipo: 'CURSO_INSCRICAO',
      usuarioId: 'ped-1',
      metadata: expect.objectContaining({
        turmaId: TURMA,
        alunoId: 'a1',
        motivo: 'Aluno da turma migrada',
        pagamento: 'CONCEDIDO',
      }),
    });
  });

  it('cobrança pendente: aguarda pagamento e o e-mail leva para pagar', async () => {
    await adicionarAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        alunoIds: ['a1'],
        motivo: 'Matrícula com pagamento',
        pagamento: 'COBRANCA_PENDENTE',
      },
      ator,
    );
    expect(db.cursosTurmasInscricoes.create.mock.calls[0][0].data).toMatchObject({
      status: 'AGUARDANDO_PAGAMENTO',
      statusPagamento: 'PENDENTE',
      valorFinal: 300,
    });
    expect(notificacoesService.criar).toHaveBeenCalledWith(
      // Endereço completo do site: no painel, /cursos/… seria a página de curso da equipe
      expect.objectContaining({
        tipo: 'TURMA_MATRICULA_ADICIONADA',
        linkAcao: `https://advancemais.com/cursos/${CURSO}`,
      }),
    );
    expect(sendGeneric.mock.calls[0][2]).toMatch(/reservada/);
  });

  it('sem aviso: não notifica nem manda e-mail', async () => {
    await adicionarAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        alunoIds: ['a1'],
        motivo: 'Regularização silenciosa',
        pagamento: 'CONCEDIDO',
        avisar: false,
      },
      ator,
    );
    expect(notificacoesService.criar).not.toHaveBeenCalled();
    expect(sendGeneric).not.toHaveBeenCalled();
  });

  it('reativa quem foi removido, com a situação de antes e o certificado de volta', async () => {
    db.cursosTurmasInscricoes.findMany.mockReset();
    inscricoesExistentes([
      {
        id: 'i1',
        alunoId: 'a1',
        status: 'CANCELADO',
        statusPagamento: 'APROVADO',
        removidaEm: new Date(),
        statusAntesRemocao: 'CONCLUIDO',
      },
    ]);
    db.cursosCertificadosEmitidos.findMany.mockResolvedValue([{ id: 'c1', formato: 'DIGITAL' }]);

    await adicionarAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        alunoIds: ['a1'],
        motivo: 'Removido por engano',
        pagamento: 'CONCEDIDO',
      },
      ator,
    );
    expect(db.cursosTurmasInscricoes.create).not.toHaveBeenCalled();
    expect(db.cursosTurmasInscricoes.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'i1' },
      data: {
        status: 'CONCLUIDO',
        removidaEm: null,
        motivoRemocao: null,
        statusAntesRemocao: null,
      },
    });
    expect(db.cursosCertificadosEmitidos.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1'] } },
      data: { revogadoEm: null, revogadoPorId: null, motivoRevogacao: null },
    });
    expect(db.auditoriaLogs.create.mock.calls[0][0].data.acao).toBe('INSCRICAO_REATIVADA');
  });
});

describe('remover alunos', () => {
  const inscricao = (extra: Record<string, unknown> = {}) => ({
    id: 'i1',
    alunoId: 'a1',
    status: 'CONCLUIDO',
    statusPagamento: 'APROVADO',
    removidaEm: null,
    Usuarios: { nomeCompleto: 'Aluno a1' },
    CursosCertificadosEmitidos: [{ id: 'c1', formato: 'DIGITAL', revogadoEm: null }],
    ...extra,
  });

  it('desvincula sem apagar: cancela, guarda a situação, revoga certificado e registra', async () => {
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([inscricao()]);
    const r: any = await removerAlunos(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        inscricaoIds: ['i1'],
        motivo: 'Nunca concluiu no sistema antigo',
        totalEsperado: 1,
      },
      ator,
    );
    expect(r).toMatchObject({ aplicado: true, certificadosARevogar: 1 });
    expect(db.cursosTurmasInscricoes.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'i1' },
      data: {
        status: 'CANCELADO',
        statusAntesRemocao: 'CONCLUIDO',
        removidaPorId: 'ped-1',
        motivoRemocao: 'Nunca concluiu no sistema antigo',
        removidaEm: expect.any(Date),
      },
    });
    expect(db.cursosCertificadosEmitidos.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1'] }, revogadoEm: null },
      data: expect.objectContaining({ revogadoPorId: 'ped-1' }),
    });
    expect(db.auditoriaLogs.create.mock.calls[0][0].data).toMatchObject({
      acao: 'INSCRICAO_REMOVIDA',
      metadata: expect.objectContaining({ alunoId: 'a1', certificadosRevogados: ['c1'] }),
    });
    expect(notificacoesService.criar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'TURMA_MATRICULA_REMOVIDA', usuarioId: 'a1' }),
    );
  });

  it('cobrança pendente é cancelada junto', async () => {
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([
      inscricao({
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
        CursosCertificadosEmitidos: [],
      }),
    ]);
    await removerAlunos(
      { cursoId: CURSO, turmaId: TURMA, inscricaoIds: ['i1'], motivo: 'Desistiu da vaga' },
      ator,
    );
    expect(db.cursosTurmasInscricoes.update.mock.calls[0][0].data.statusPagamento).toBe(
      'CANCELADO',
    );
  });

  it('se a turma mudou desde a prévia, pede nova prévia', async () => {
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([inscricao()]);
    await expect(
      removerAlunos(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          inscricaoIds: ['i1'],
          motivo: 'motivo ok',
          totalEsperado: 3,
        },
        ator,
      ),
    ).rejects.toMatchObject({ code: 'ALVO_MUDOU', statusCode: 409 });
    expect(db.cursosTurmasInscricoes.update).not.toHaveBeenCalled();
  });

  it('quem já foi removido não é removido de novo', async () => {
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([inscricao({ removidaEm: new Date() })]);
    await expect(
      removerAlunos(
        { cursoId: CURSO, turmaId: TURMA, inscricaoIds: ['i1'], motivo: 'motivo ok' },
        ator,
      ),
    ).rejects.toMatchObject({ code: 'NADA_A_REMOVER' });
  });
});
