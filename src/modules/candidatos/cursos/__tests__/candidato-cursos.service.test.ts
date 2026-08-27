import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { candidatoCursosService } from '../services';

const usuarioId = 'usuario-123';

const buildInscricao = (overrides: Record<string, any> = {}) => ({
  id: 'inscricao-123',
  status: StatusInscricao.INSCRITO,
  turmaId: 'turma-123',
  criadoEm: new Date('2026-05-01T10:00:00.000Z'),
  CursosAulasProgresso: [{ aulaId: 'aula-1' }],
  CursosFrequenciaAlunos: [{ aulaId: 'aula-1' }],
  CursosTurmasProvasEnvios: [{ provaId: 'prova-1' }],
  CursosTurmas: {
    id: 'turma-123',
    nome: 'Turma Online',
    metodo: 'ONLINE',
    dataInicio: new Date('2026-06-01T00:00:00.000Z'),
    dataFim: new Date('2026-07-01T00:00:00.000Z'),
    CursosTurmasAulas: [1, 2, 3, 4].map((ordem) => ({ id: `aula-${ordem}` })),
    CursosTurmasProvas: [{ id: 'prova-1' }],
    Cursos: {
      id: 'curso-123',
      nome: 'Curso Online',
      descricao: 'Descrição do curso',
      imagemUrl: 'https://example.com/curso.jpg',
      cargaHoraria: 20,
    },
  },
  CursosNotas: [
    {
      nota: 8,
      peso: 1,
    },
  ],
  ...overrides,
});

describe('candidatoCursosService.listCursos', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.cursosTurmasAulas, 'findFirst').mockResolvedValue(null as any);
  });

  it('filtra apenas inscrições liberadas com pagamento aprovado', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, { page: 2, limit: 4 });

    const countArgs = (prisma.cursosTurmasInscricoes.count as jest.Mock).mock.calls[0][0] as any;
    const findManyArgs = (prisma.cursosTurmasInscricoes.findMany as jest.Mock).mock
      .calls[0][0] as any;

    expect(countArgs.where).toMatchObject({
      alunoId: usuarioId,
      statusPagamento: 'APROVADO',
    });
    expect(countArgs.where.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
      StatusInscricao.CONCLUIDO,
    ]);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.CANCELADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.TRANCADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.REPROVADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
    expect(findManyArgs.where).toEqual(countArgs.where);
    expect(findManyArgs.skip).toBe(4);
    expect(findManyArgs.take).toBe(4);
  });

  it('mantém o filtro de modalidade antes da paginação', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, {
      modalidade: 'AO_VIVO',
      page: 1,
      limit: 8,
    });

    const countArgs = (prisma.cursosTurmasInscricoes.count as jest.Mock).mock.calls[0][0] as any;

    expect(countArgs.where.CursosTurmas).toEqual({
      metodo: {
        in: ['LIVE'],
      },
    });
  });

  it('retorna os campos esperados pelo frontend', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(1);
    jest
      .spyOn(prisma.cursosTurmasInscricoes, 'findMany')
      .mockResolvedValue([buildInscricao()] as any);

    const result = await candidatoCursosService.listCursos(usuarioId, { page: 1, limit: 8 });

    expect(result.cursos).toHaveLength(1);
    expect(result.cursos[0]).toMatchObject({
      id: 'inscricao-123',
      cursoId: 'curso-123',
      turmaId: 'turma-123',
      status: 'Não iniciado',
      statusRaw: StatusInscricao.INSCRITO,
      nome: 'Curso Online',
      quantidadeAulas: 5,
      progresso: 40,
      notaMedia: 8,
      modalidade: 'ONLINE',
      cargaHoraria: 20,
    });
    expect(result.cursos[0].dataInicio).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(result.paginacao).toMatchObject({
      page: 1,
      limit: 8,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('busca próxima aula apenas para inscrições liberadas e aprovadas', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, { page: 1, limit: 8 });

    const findFirstArgs = (prisma.cursosTurmasAulas.findFirst as jest.Mock).mock.calls[0][0] as any;
    const inscricaoWhere = findFirstArgs.where.CursosTurmas.CursosTurmasInscricoes.some;

    expect(inscricaoWhere).toMatchObject({
      alunoId: usuarioId,
      statusPagamento: 'APROVADO',
    });
    expect(inscricaoWhere.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
    ]);
    expect(inscricaoWhere.status.in).not.toContain(StatusInscricao.CONCLUIDO);
    expect(inscricaoWhere.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
  });
});

describe('candidatoCursosService.getTurmaEstrutura', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('expõe somente envios efetivos como atividades respondidas', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findFirst').mockResolvedValue({
      id: 'inscricao-123',
      CursosAulasProgresso: [
        {
          aulaId: 'aula-em-progresso',
          percentualAssistido: 55,
          tempoAssistidoSegundos: 330,
          concluida: false,
          concluidaEm: null,
          atualizadoEm: new Date('2026-08-26T11:00:00.000Z'),
        },
      ],
      CursosFrequenciaAlunos: [],
      CursosTurmas: {
        id: 'turma-123',
        nome: 'Turma Online',
        metodo: 'ONLINE',
        estruturaTipo: 'MODULAR',
        dataInicio: new Date('2026-08-01T00:00:00.000Z'),
        dataFim: new Date('2026-08-31T23:59:59.000Z'),
        Cursos: {
          id: 'curso-123',
          nome: 'Curso Online',
          descricao: 'Curso de treinamento',
          cargaHoraria: 20,
        },
        CursosTurmasModulos: [
          {
            id: 'modulo-123',
            nome: 'Módulo 1',
            ordem: 1,
            CursosTurmasAulas: [
              {
                id: 'aula-em-progresso',
                nome: 'Aula em progresso',
                dataInicio: null,
                dataFim: null,
                horaInicio: null,
                horaFim: null,
                instrutorId: null,
                obrigatoria: true,
                modalidade: 'ONLINE',
                urlVideo: null,
                urlMeet: null,
                tipoLink: null,
                ordem: 0,
              },
            ],
            CursosTurmasProvas: [
              {
                id: 'atividade-respondida',
                titulo: 'Plano de aula',
                tipo: 'ATIVIDADE',
                descricao: null,
                dataInicio: null,
                dataFim: null,
                horaInicio: null,
                horaTermino: null,
                instrutorId: null,
                obrigatoria: true,
                recuperacaoFinal: false,
                modalidade: 'ONLINE',
                tipoAtividade: 'PERGUNTA_RESPOSTA',
                ordem: 1,
                CursosTurmasProvasEnvios: [
                  {
                    tentativasEnvio: 1,
                    realizadoEm: new Date('2026-08-26T12:00:00.000Z'),
                    nota: null,
                    bloqueadoEdicaoEm: null,
                    CursosTurmasProvasRespostas: [{ corrigida: false }],
                  },
                ],
              },
              {
                id: 'atividade-sem-resposta',
                titulo: 'Atividade ainda não enviada',
                tipo: 'ATIVIDADE',
                descricao: null,
                dataInicio: null,
                dataFim: null,
                horaInicio: null,
                horaTermino: null,
                instrutorId: null,
                obrigatoria: true,
                recuperacaoFinal: false,
                modalidade: 'ONLINE',
                tipoAtividade: 'PERGUNTA_RESPOSTA',
                ordem: 2,
                CursosTurmasProvasEnvios: [
                  {
                    tentativasEnvio: 0,
                    realizadoEm: null,
                    nota: null,
                    bloqueadoEdicaoEm: null,
                    CursosTurmasProvasRespostas: [],
                  },
                ],
              },
            ],
          },
        ],
        CursosTurmasAulas: [],
        CursosTurmasProvas: [],
      },
    } as any);

    const result = await candidatoCursosService.getTurmaEstrutura(
      usuarioId,
      'curso-123',
      'turma-123',
    );

    expect(result?.estrutura.modules[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'aula-em-progresso',
          progresso: expect.objectContaining({
            status: 'EM_PROGRESSO',
            percentualConcluido: 55,
          }),
        }),
        expect.objectContaining({
          id: 'atividade-respondida',
          situacaoAluno: 'AGUARDANDO_CORRECAO',
          respondidaEm: '2026-08-26T12:00:00.000Z',
        }),
        expect.objectContaining({
          id: 'atividade-sem-resposta',
          situacaoAluno: null,
          respondidaEm: null,
        }),
      ]),
    );

    const query = (prisma.cursosTurmasInscricoes.findFirst as jest.Mock).mock.calls[0][0] as any;
    expect(
      query.select.CursosTurmas.select.CursosTurmasModulos.select.CursosTurmasProvas.include
        .CursosTurmasProvasEnvios.where,
    ).toEqual({ CursosTurmasInscricoes: { alunoId: usuarioId } });
  });
});

describe('candidatoCursosService.enviarAtividadeResposta', () => {
  const cursoId = 'curso-123';
  const turmaId = 'turma-123';
  const atividadeId = 'atividade-123';
  const questaoId = 'questao-123';

  const buildTx = (envioOverrides: Record<string, any> = {}) => ({
    cursosTurmasInscricoes: {
      findFirst: jest.fn().mockResolvedValue({ id: 'inscricao-123' }),
    },
    cursosTurmasProvas: {
      findFirst: jest.fn().mockResolvedValue({
        id: atividadeId,
        tipo: 'ATIVIDADE',
        dataInicio: null,
        dataFim: null,
        horaInicio: null,
        horaTermino: null,
        CursosTurmasProvasQuestoes: [
          {
            id: questaoId,
            tipo: 'TEXTO',
            obrigatoria: true,
            CursosTurmasProvasQuestoesAlternativas: [],
          },
        ],
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: atividadeId,
        tipo: 'ATIVIDADE',
        titulo: 'Atividade de teste',
        descricao: 'Descreva a solução',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        dataInicio: null,
        dataFim: null,
        horaInicio: null,
        horaTermino: null,
        CursosTurmasProvasQuestoes: [
          {
            id: questaoId,
            enunciado: 'Como você resolveria?',
            tipo: 'TEXTO',
            ordem: 1,
            obrigatoria: true,
            CursosTurmasProvasQuestoesAlternativas: [],
          },
        ],
        CursosTurmasProvasEnvios: [
          {
            id: 'envio-123',
            tentativasEnvio: 4,
            bloqueadoEdicaoEm: null,
            nota: null,
            observacoes: null,
            realizadoEm: new Date('2026-08-26T12:00:00.000Z'),
            atualizadoEm: new Date('2026-08-26T12:05:00.000Z'),
            CursosTurmasProvasRespostas: [
              {
                questaoId,
                respostaTexto: 'Resposta final',
                alternativaId: null,
                anexoUrl: null,
                anexoNome: null,
                corrigida: false,
              },
            ],
          },
        ],
      }),
    },
    cursosTurmasProvasEnvios: {
      upsert: jest.fn().mockResolvedValue({
        id: 'envio-123',
        tentativasEnvio: 3,
        bloqueadoEdicaoEm: null,
        nota: null,
        realizadoEm: null,
        CursosTurmasProvasRespostas: [],
        ...envioOverrides,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'envio-123' }),
    },
    cursosNotas: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    cursosTurmasProvasRespostas: {
      upsert: jest.fn().mockResolvedValue({ id: 'resposta-123' }),
    },
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('registra a terceira edição como uma única tentativa', async () => {
    const tx = buildTx();
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    const result = await candidatoCursosService.enviarAtividadeResposta(
      usuarioId,
      cursoId,
      turmaId,
      atividadeId,
      [{ questaoId, respostaTexto: 'Resposta final' }],
    );

    expect(tx.cursosTurmasProvasEnvios.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.cursosTurmasProvasEnvios.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tentativasEnvio: { increment: 1 } }),
      }),
    );
    expect(tx.cursosTurmasProvasRespostas.upsert).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      tentativasEnvio: 4,
      edicoesRealizadas: 3,
      edicoesRestantes: 0,
      ultimaEdicaoEm: '2026-08-26T12:05:00.000Z',
    });
  });

  it('recusa uma quarta edição', async () => {
    const tx = buildTx({ tentativasEnvio: 4 });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      candidatoCursosService.enviarAtividadeResposta(usuarioId, cursoId, turmaId, atividadeId, [
        { questaoId, respostaTexto: 'Quarta edição' },
      ]),
    ).rejects.toMatchObject({ code: 'ATIVIDADE_LIMITE_ENVIOS' });

    expect(tx.cursosTurmasProvasEnvios.updateMany).not.toHaveBeenCalled();
    expect(tx.cursosTurmasProvasRespostas.upsert).not.toHaveBeenCalled();
  });

  it('recusa envio depois do encerramento do período', async () => {
    const tx = buildTx();
    tx.cursosTurmasProvas.findFirst.mockResolvedValue({
      id: atividadeId,
      dataInicio: new Date('2020-08-12T00:00:00.000Z'),
      dataFim: new Date('2020-08-13T00:00:00.000Z'),
      horaInicio: '10:00',
      horaTermino: '12:00',
      CursosTurmasProvasQuestoes: [],
    });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      candidatoCursosService.enviarAtividadeResposta(usuarioId, cursoId, turmaId, atividadeId, []),
    ).rejects.toMatchObject({ code: 'ATIVIDADE_FORA_DO_PERIODO' });

    expect(tx.cursosTurmasProvasEnvios.upsert).not.toHaveBeenCalled();
  });

  it('recusa edição depois que a atividade foi corrigida', async () => {
    const tx = buildTx({
      tentativasEnvio: 1,
      bloqueadoEdicaoEm: new Date('2026-08-26T13:00:00.000Z'),
    });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      candidatoCursosService.enviarAtividadeResposta(usuarioId, cursoId, turmaId, atividadeId, [
        { questaoId, respostaTexto: 'Tentativa após correção' },
      ]),
    ).rejects.toMatchObject({ code: 'ATIVIDADE_CORRIGIDA' });

    expect(tx.cursosTurmasProvasRespostas.upsert).not.toHaveBeenCalled();
  });

  it('recusa edição quando a nota consolidada já foi registrada', async () => {
    const tx = buildTx({ tentativasEnvio: 1 });
    tx.cursosNotas.findUnique.mockResolvedValue({ id: 'nota-123' });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      candidatoCursosService.enviarAtividadeResposta(usuarioId, cursoId, turmaId, atividadeId, [
        { questaoId, respostaTexto: 'Tentativa após nota' },
      ]),
    ).rejects.toMatchObject({ code: 'ATIVIDADE_CORRIGIDA' });

    expect(tx.cursosTurmasProvasEnvios.updateMany).not.toHaveBeenCalled();
    expect(tx.cursosTurmasProvasRespostas.upsert).not.toHaveBeenCalled();
  });

  it('corrige prova objetiva no servidor e oculta o gabarito antes da liberação', async () => {
    const tx = buildTx();
    const alternativaCorretaId = 'alternativa-correta';
    const dataFim = new Date('2099-08-26T00:00:00.000Z');

    tx.cursosTurmasProvas.findFirst.mockResolvedValue({
      id: atividadeId,
      tipo: 'PROVA',
      titulo: 'Prova objetiva',
      descricao: null,
      tipoAtividade: null,
      peso: 10,
      dataInicio: null,
      dataFim,
      horaInicio: null,
      horaTermino: '17:30',
      CursosTurmasProvasQuestoes: [
        {
          id: questaoId,
          tipo: 'MULTIPLA_ESCOLHA',
          peso: 10,
          obrigatoria: true,
          CursosTurmasProvasQuestoesAlternativas: [{ id: alternativaCorretaId, correta: true }],
        },
      ],
    });
    tx.cursosTurmasProvas.findUnique.mockResolvedValue({
      id: atividadeId,
      tipo: 'PROVA',
      titulo: 'Prova objetiva',
      descricao: null,
      tipoAtividade: null,
      peso: 10,
      dataInicio: null,
      dataFim,
      horaInicio: null,
      horaTermino: '17:30',
      CursosTurmasProvasQuestoes: [
        {
          id: questaoId,
          enunciado: 'Qual é a alternativa correta?',
          tipo: 'MULTIPLA_ESCOLHA',
          ordem: 1,
          obrigatoria: true,
          CursosTurmasProvasQuestoesAlternativas: [
            { id: alternativaCorretaId, texto: 'Correta', ordem: 1, correta: true },
          ],
        },
      ],
      CursosTurmasProvasEnvios: [
        {
          id: 'envio-123',
          tentativasEnvio: 1,
          bloqueadoEdicaoEm: new Date(),
          nota: 10,
          observacoes: null,
          realizadoEm: new Date(),
          atualizadoEm: new Date(),
          CursosTurmasProvasRespostas: [
            {
              questaoId,
              respostaTexto: null,
              alternativaId: alternativaCorretaId,
              anexoUrl: null,
              anexoNome: null,
              corrigida: true,
              nota: 10,
            },
          ],
        },
      ],
      CursosNotas: [],
    });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    const result = await candidatoCursosService.enviarAtividadeResposta(
      usuarioId,
      cursoId,
      turmaId,
      atividadeId,
      [{ questaoId, alternativaId: alternativaCorretaId }],
    );

    expect(tx.cursosTurmasProvasEnvios.update).toHaveBeenCalledWith({
      where: { id: 'envio-123' },
      data: expect.objectContaining({
        nota: expect.anything(),
        bloqueadoEdicaoEm: expect.any(Date),
      }),
    });
    expect(result).toMatchObject({
      tipo: 'PROVA',
      nota: null,
      aguardandoGabarito: true,
      gabaritoDisponivel: false,
      resultado: null,
    });
    expect(result.questoes[0].alternativas[0]).not.toHaveProperty('correta');
  });

  it('recusa um segundo envio da prova', async () => {
    const tx = buildTx({
      tentativasEnvio: 1,
      realizadoEm: new Date('2026-08-26T20:20:00.000Z'),
    });
    tx.cursosTurmasProvas.findFirst.mockResolvedValue({
      id: atividadeId,
      tipo: 'PROVA',
      peso: 10,
      dataInicio: null,
      dataFim: null,
      horaInicio: null,
      horaTermino: null,
      CursosTurmasProvasQuestoes: [
        {
          id: questaoId,
          tipo: 'MULTIPLA_ESCOLHA',
          peso: 10,
          obrigatoria: true,
          CursosTurmasProvasQuestoesAlternativas: [{ id: 'alternativa-1', correta: true }],
        },
      ],
    });
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      candidatoCursosService.enviarAtividadeResposta(usuarioId, cursoId, turmaId, atividadeId, [
        { questaoId, alternativaId: 'alternativa-1' },
      ]),
    ).rejects.toMatchObject({ code: 'AVALIACAO_JA_ENVIADA' });

    expect(tx.cursosTurmasProvasRespostas.upsert).not.toHaveBeenCalled();
  });
});
