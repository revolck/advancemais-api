const eventsGet = jest.fn();
const eventsPatch = jest.fn();
const eventsList = jest.fn();
const eventsDelete = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: { get: eventsGet, patch: eventsPatch, list: eventsList, delete: eventsDelete },
    })),
  },
}));
jest.mock('../services/google-oauth.service', () => ({
  googleOAuthService: { getOAuth2Client: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../services/meet-attendees.helper', () => ({
  resolveOrganizadorId: (itemInstrutorId: string | null, turma: { instrutorId: string | null }) =>
    itemInstrutorId ?? turma.instrutorId,
}));
jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: { findUnique: jest.fn() },
    cursosTurmas: { findUnique: jest.fn() },
  },
}));

import { prisma } from '@/config/prisma';
import { googleOAuthService } from '../services/google-oauth.service';
import { googleCalendarService } from '../services/google-calendar.service';

const db = prisma as any;
const INICIO = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
const FIM = new Date(INICIO.getTime() + 60 * 60 * 1000);

beforeEach(() => {
  jest.clearAllMocks();
  eventsPatch.mockResolvedValue({});
  eventsDelete.mockResolvedValue({});
});

describe('convites do Meet da turma', () => {
  beforeEach(() => {
    db.usuarios.findUnique.mockResolvedValue({ email: 'Ana@Teste.com' });
    db.cursosTurmas.findUnique.mockResolvedValue({
      instrutorId: 'inst-1',
      CursosTurmasInstrutores: [],
      CursosTurmasAulas: [{ id: 'au1', meetEventId: 'ev-aula', instrutorId: null }],
      CursosTurmasProvas: [{ id: 'p1', meetEventId: 'ev-prova', instrutorId: 'inst-2' }],
    });
  });

  it('remover: tira só o aluno da lista de convidados, sem e-mail do Google', async () => {
    eventsGet.mockImplementation(async ({ eventId }: { eventId: string }) => ({
      data: {
        attendees:
          eventId === 'ev-aula'
            ? [{ email: 'ana@teste.com', responseStatus: 'accepted' }, { email: 'bia@teste.com' }]
            : [{ email: 'bia@teste.com' }],
      },
    }));
    const r = await googleCalendarService.ajustarConviteDoAluno({
      alunoId: 'a1',
      turmaId: 't1',
      acao: 'remover',
    });
    expect(r).toEqual({ alterados: 1, erros: 0 });
    expect(eventsPatch).toHaveBeenCalledTimes(1);
    expect(eventsPatch).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'ev-aula',
      sendUpdates: 'none',
      requestBody: { attendees: [{ email: 'bia@teste.com' }] },
    });
    // Cada evento na agenda do seu organizador
    expect(googleOAuthService.getOAuth2Client).toHaveBeenCalledWith('inst-1');
    expect(googleOAuthService.getOAuth2Client).toHaveBeenCalledWith('inst-2');
  });

  it('adicionar: mantém quem já estava e põe o aluno', async () => {
    eventsGet.mockResolvedValue({ data: { attendees: [{ email: 'bia@teste.com' }] } });
    const r = await googleCalendarService.ajustarConviteDoAluno({
      alunoId: 'a1',
      turmaId: 't1',
      acao: 'adicionar',
    });
    expect(r.alterados).toBe(2);
    expect(eventsPatch.mock.calls[0][0].requestBody.attendees).toEqual([
      { email: 'bia@teste.com' },
      { email: 'Ana@Teste.com' },
    ]);
  });

  it('um evento com erro não impede os outros', async () => {
    eventsGet
      .mockRejectedValueOnce(new Error('Evento não existe mais'))
      .mockResolvedValueOnce({ data: { attendees: [{ email: 'ana@teste.com' }] } });
    const r = await googleCalendarService.ajustarConviteDoAluno({
      alunoId: 'a1',
      turmaId: 't1',
      acao: 'remover',
    });
    expect(r).toEqual({ alterados: 1, erros: 1 });
  });
});

describe('eventos na agenda do próprio aluno', () => {
  beforeEach(() => {
    db.usuarios.findUnique.mockResolvedValue({ googleAccessToken: 'token' });
    db.cursosTurmas.findUnique.mockResolvedValue({
      CursosTurmasAulas: [{ nome: 'Introdução', dataInicio: INICIO, dataFim: FIM }],
      CursosTurmasProvas: [],
    });
  });

  it('apaga os marcados com a turma e os antigos criados pela plataforma; não mexe no resto', async () => {
    eventsList.mockResolvedValue({
      data: {
        items: [
          // marcado (criado a partir desta versão)
          { id: 'e1', extendedProperties: { private: { advanceTurmaId: 't1' } } },
          // antigo: mesmo título e horário, criado pelo próprio aluno
          {
            id: 'e2',
            summary: '📚 Introdução',
            start: { dateTime: INICIO.toISOString() },
            organizer: { self: true },
          },
          // mesmo título, outro horário: fica
          {
            id: 'e3',
            summary: '📚 Introdução',
            start: { dateTime: FIM.toISOString() },
            organizer: { self: true },
          },
          // convite de outra pessoa com o mesmo título e horário: fica
          {
            id: 'e4',
            summary: '📚 Introdução',
            start: { dateTime: INICIO.toISOString() },
            organizer: { email: 'prof@x.com' },
          },
          // marcado com outra turma: fica
          { id: 'e5', extendedProperties: { private: { advanceTurmaId: 't2' } } },
        ],
      },
    });
    const r = await googleCalendarService.apagarEventosDoAluno({ alunoId: 'a1', turmaId: 't1' });
    expect(r).toEqual({ apagados: 2, erros: 0 });
    expect(eventsDelete.mock.calls.map((c) => c[0].eventId)).toEqual(['e1', 'e2']);
  });

  it('aluno sem Google conectado: nada a fazer', async () => {
    db.usuarios.findUnique.mockResolvedValue({ googleAccessToken: null });
    const r = await googleCalendarService.apagarEventosDoAluno({ alunoId: 'a1', turmaId: 't1' });
    expect(r).toEqual({ apagados: 0, erros: 0 });
    expect(eventsList).not.toHaveBeenCalled();
  });
});
