import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { questoesService } from '../questoes.service';

describe('questoesService.responder', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('impede que o aluno contorne o limite de edições pelo endpoint legado', async () => {
    const tx = {
      cursosTurmasProvas: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'atividade-123',
          status: 'PUBLICADA',
          turmaId: 'turma-123',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'atividade-123',
          tipo: 'ATIVIDADE',
          titulo: 'Atividade',
          descricao: null,
          peso: 10,
        }),
      },
      cursosTurmasProvasQuestoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'questao-123' }),
        findUnique: jest.fn().mockResolvedValue({ tipo: 'TEXTO' }),
      },
      cursosTurmasInscricoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inscricao-123' }),
      },
      cursosTurmasProvasEnvios: {
        upsert: jest.fn(),
      },
    };
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      questoesService.responder(
        'curso-123',
        'turma-123',
        'atividade-123',
        'questao-123',
        'inscricao-123',
        { respostaTexto: 'Resposta alterada' },
        { usuarioId: 'aluno-123', usuarioRole: Roles.ALUNO_CANDIDATO },
      ),
    ).rejects.toMatchObject({ code: 'ATIVIDADE_ENVIO_ENDPOINT_REQUIRED' });

    expect(tx.cursosTurmasProvasEnvios.upsert).not.toHaveBeenCalled();
  });

  it('recusa uma alternativa que pertence a outra questão', async () => {
    const tx = {
      cursosTurmasProvas: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prova-123',
          status: 'PUBLICADA',
          turmaId: 'turma-123',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'prova-123',
          tipo: 'PROVA',
          titulo: 'Prova',
          descricao: null,
          peso: 10,
          ativo: true,
          status: 'PUBLICADA',
          dataInicio: null,
          dataFim: null,
          horaInicio: null,
          horaTermino: null,
        }),
      },
      cursosTurmasProvasQuestoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'questao-123' }),
        findUnique: jest.fn().mockResolvedValue({
          tipo: 'MULTIPLA_ESCOLHA',
          CursosTurmasProvasQuestoesAlternativas: [{ id: 'alternativa-valida' }],
        }),
      },
      cursosTurmasInscricoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inscricao-123' }),
      },
      cursosTurmasProvasEnvios: { upsert: jest.fn() },
    };
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      questoesService.responder(
        'curso-123',
        'turma-123',
        'prova-123',
        'questao-123',
        'inscricao-123',
        { alternativaId: 'alternativa-de-outra-questao' },
        { usuarioId: 'aluno-123', usuarioRole: Roles.ALUNO_CANDIDATO },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(tx.cursosTurmasProvasEnvios.upsert).not.toHaveBeenCalled();
  });

  it('recusa resposta do aluno depois do encerramento da prova', async () => {
    const tx = {
      cursosTurmasProvas: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prova-123',
          status: 'PUBLICADA',
          turmaId: 'turma-123',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'prova-123',
          tipo: 'PROVA',
          titulo: 'Prova',
          descricao: null,
          peso: 10,
          ativo: true,
          status: 'PUBLICADA',
          dataInicio: new Date('2020-08-26T00:00:00.000Z'),
          dataFim: new Date('2020-08-26T00:00:00.000Z'),
          horaInicio: '17:00',
          horaTermino: '17:30',
        }),
      },
      cursosTurmasProvasQuestoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'questao-123' }),
        findUnique: jest.fn().mockResolvedValue({
          tipo: 'MULTIPLA_ESCOLHA',
          CursosTurmasProvasQuestoesAlternativas: [{ id: 'alternativa-valida' }],
        }),
      },
      cursosTurmasInscricoes: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inscricao-123' }),
      },
      cursosTurmasProvasEnvios: { upsert: jest.fn() },
    };
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: any) => callback(tx)) as any);

    await expect(
      questoesService.responder(
        'curso-123',
        'turma-123',
        'prova-123',
        'questao-123',
        'inscricao-123',
        { alternativaId: 'alternativa-valida' },
        { usuarioId: 'aluno-123', usuarioRole: Roles.ALUNO_CANDIDATO },
      ),
    ).rejects.toMatchObject({ code: 'AVALIACAO_FORA_DO_PERIODO' });

    expect(tx.cursosTurmasProvasEnvios.upsert).not.toHaveBeenCalled();
  });
});
