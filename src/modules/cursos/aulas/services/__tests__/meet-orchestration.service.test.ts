const mockAulaFindUnique = jest.fn();
const mockAulaUpdate = jest.fn();
const mockProvaFindUnique = jest.fn();
const mockProvaUpdate = jest.fn();
const mockTurmaFindUnique = jest.fn();
const mockInscricoesFindMany = jest.fn();
const mockUsuariosFindMany = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmasAulas: { findUnique: mockAulaFindUnique, update: mockAulaUpdate },
    cursosTurmasProvas: { findUnique: mockProvaFindUnique, update: mockProvaUpdate },
    cursosTurmas: { findUnique: mockTurmaFindUnique },
    cursosTurmasInscricoes: { findMany: mockInscricoesFindMany },
    usuarios: { findMany: mockUsuariosFindMany },
  },
}));

jest.mock('@/modules/configuracoes-gerais', () => ({
  runtimeConfigService: {
    getGoogleMeetInstitutionalEmails: jest.fn(async () => []),
  },
}));

const mockCreateMeetEvent = jest.fn();
jest.mock('../google-calendar.service', () => ({
  googleCalendarService: { createMeetEvent: mockCreateMeetEvent },
  extractMeetingCodeFromUrl: jest.requireActual('../google-calendar.service')
    .extractMeetingCodeFromUrl,
}));

const mockConfigureSpace = jest.fn();
jest.mock('../google-meet.service', () => ({
  googleMeetService: { configureSpace: mockConfigureSpace },
}));

const mockGetOAuth2Client = jest.fn();
jest.mock('../google-oauth.service', () => ({
  googleOAuthService: { getOAuth2Client: mockGetOAuth2Client },
}));

import { meetOrchestrationService } from '../meet-orchestration.service';

const turmaPadrao = {
  instrutorId: 'turma-instrutor',
  CursosTurmasInstrutores: [] as { instrutorId: string }[],
};

describe('meetOrchestrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsuariosFindMany.mockResolvedValue([]);
    mockInscricoesFindMany.mockResolvedValue([]);
    mockTurmaFindUnique.mockResolvedValue(turmaPadrao);
    mockGetOAuth2Client.mockResolvedValue({});
    mockConfigureSpace.mockResolvedValue({ spaceName: 'spaces/abc-defg-hij' });
    mockCreateMeetEvent.mockResolvedValue({
      eventId: 'evt-1',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
    });
  });

  describe('ensureMeetParaAula', () => {
    const aulaBase = {
      id: 'aula-1',
      nome: 'Aula 1',
      descricao: 'desc',
      modalidade: 'LIVE',
      tipoLink: null,
      turmaId: 'turma-1',
      instrutorId: 'item-instrutor',
      dataInicio: new Date('2026-09-01T00:00:00.000Z'),
      dataFim: new Date('2026-09-01T00:00:00.000Z'),
      horaInicio: '10:00',
      horaFim: '11:00',
      meetEventId: null,
      gravarAula: true,
      deletedAt: null,
    };

    it('não faz nada se a aula já tiver meetEventId (idempotente)', async () => {
      mockAulaFindUnique.mockResolvedValue({ ...aulaBase, meetEventId: 'ja-existe' });

      await meetOrchestrationService.ensureMeetParaAula('aula-1');

      expect(mockCreateMeetEvent).not.toHaveBeenCalled();
    });

    it('não faz nada se a modalidade não for elegível', async () => {
      mockAulaFindUnique.mockResolvedValue({ ...aulaBase, modalidade: 'ONLINE' });

      await meetOrchestrationService.ensureMeetParaAula('aula-1');

      expect(mockCreateMeetEvent).not.toHaveBeenCalled();
    });

    it('cria o Meet usando o instrutor do item (prioridade sobre o da turma) e persiste os dados', async () => {
      mockAulaFindUnique.mockResolvedValue(aulaBase);

      await meetOrchestrationService.ensureMeetParaAula('aula-1');

      expect(mockCreateMeetEvent).toHaveBeenCalledWith(
        expect.objectContaining({ instrutorId: 'item-instrutor' }),
      );
      expect(mockAulaUpdate).toHaveBeenCalledWith({
        where: { id: 'aula-1' },
        data: { meetEventId: 'evt-1', urlMeet: 'https://meet.google.com/abc-defg-hij' },
      });
      expect(mockConfigureSpace).toHaveBeenCalledWith(
        expect.objectContaining({ habilitarGravacaoAutomatica: true }),
      );
      expect(mockAulaUpdate).toHaveBeenCalledWith({
        where: { id: 'aula-1' },
        data: { meetSpaceName: 'spaces/abc-defg-hij' },
      });
    });

    it('cai para o instrutor da turma quando o item não tem instrutor próprio', async () => {
      mockAulaFindUnique.mockResolvedValue({ ...aulaBase, instrutorId: null });

      await meetOrchestrationService.ensureMeetParaAula('aula-1');

      expect(mockCreateMeetEvent).toHaveBeenCalledWith(
        expect.objectContaining({ instrutorId: 'turma-instrutor' }),
      );
    });

    it('não faz nada se não houver nenhum instrutor resolvível', async () => {
      mockAulaFindUnique.mockResolvedValue({ ...aulaBase, instrutorId: null });
      mockTurmaFindUnique.mockResolvedValue({ instrutorId: null, CursosTurmasInstrutores: [] });

      await meetOrchestrationService.ensureMeetParaAula('aula-1');

      expect(mockCreateMeetEvent).not.toHaveBeenCalled();
    });

    it('não lança mesmo se a criação do Meet falhar', async () => {
      mockAulaFindUnique.mockResolvedValue(aulaBase);
      mockCreateMeetEvent.mockRejectedValue(new Error('Google indisponível'));

      await expect(meetOrchestrationService.ensureMeetParaAula('aula-1')).resolves.toBeUndefined();
      expect(mockAulaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('ensureMeetParaProvaOuAtividade', () => {
    const provaBase = {
      id: 'prova-1',
      titulo: 'Prova 1',
      descricao: 'desc',
      modalidade: 'LIVE',
      turmaId: 'turma-1',
      instrutorId: 'item-instrutor',
      dataInicio: new Date('2026-09-01T00:00:00.000Z'),
      dataFim: new Date('2026-09-01T00:00:00.000Z'),
      horaInicio: '10:00',
      horaTermino: '11:00',
      meetEventId: null,
    };

    it('não faz nada se modalidade não for AO_VIVO (LIVE)', async () => {
      mockProvaFindUnique.mockResolvedValue({ ...provaBase, modalidade: 'ONLINE' });

      await meetOrchestrationService.ensureMeetParaProvaOuAtividade('prova-1');

      expect(mockCreateMeetEvent).not.toHaveBeenCalled();
    });

    it('cria o Meet sem habilitar gravação automática', async () => {
      mockProvaFindUnique.mockResolvedValue(provaBase);

      await meetOrchestrationService.ensureMeetParaProvaOuAtividade('prova-1');

      expect(mockCreateMeetEvent).toHaveBeenCalledWith(
        expect.objectContaining({ instrutorId: 'item-instrutor' }),
      );
      expect(mockProvaUpdate).toHaveBeenCalledWith({
        where: { id: 'prova-1' },
        data: { meetEventId: 'evt-1', urlMeet: 'https://meet.google.com/abc-defg-hij' },
      });
      expect(mockConfigureSpace).toHaveBeenCalledWith(
        expect.objectContaining({ habilitarGravacaoAutomatica: false }),
      );
    });

    it('não faz nada se já existir meetEventId (idempotente)', async () => {
      mockProvaFindUnique.mockResolvedValue({ ...provaBase, meetEventId: 'ja-existe' });

      await meetOrchestrationService.ensureMeetParaProvaOuAtividade('prova-1');

      expect(mockCreateMeetEvent).not.toHaveBeenCalled();
    });
  });
});
