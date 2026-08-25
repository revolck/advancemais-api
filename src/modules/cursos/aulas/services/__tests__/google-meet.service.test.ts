const mockSpacesPatch = jest.fn();
const mockConferenceRecordsList = jest.fn();
const mockRecordingsList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    meet: jest.fn(() => ({
      spaces: { patch: mockSpacesPatch },
      conferenceRecords: {
        list: mockConferenceRecordsList,
        recordings: { list: mockRecordingsList },
      },
    })),
  },
}));

import { googleMeetService } from '../google-meet.service';

const fakeOAuth2Client = {} as any;

describe('googleMeetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configureSpace', () => {
    it('deriva o spaces/{code} a partir da URL do Meet e configura acesso restrito + moderação', async () => {
      mockSpacesPatch.mockResolvedValue({ data: { name: 'spaces/abc-defg-hij' } });

      const resultado = await googleMeetService.configureSpace({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        habilitarGravacaoAutomatica: false,
      });

      expect(mockSpacesPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'spaces/abc-defg-hij',
          updateMask: 'config.accessType,config.moderation',
          requestBody: { config: { accessType: 'RESTRICTED', moderation: 'ON' } },
        }),
      );
      expect(resultado).toEqual({ spaceName: 'spaces/abc-defg-hij' });
    });

    it('inclui autoRecordingGeneration no updateMask quando habilitado', async () => {
      mockSpacesPatch.mockResolvedValue({ data: { name: 'spaces/abc-defg-hij' } });

      await googleMeetService.configureSpace({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        habilitarGravacaoAutomatica: true,
      });

      const chamada = mockSpacesPatch.mock.calls[0][0];
      expect(chamada.updateMask).toContain(
        'artifactConfig.recordingConfig.autoRecordingGeneration',
      );
      expect(chamada.requestBody.config.artifactConfig).toEqual({
        recordingConfig: { autoRecordingGeneration: 'ON' },
      });
    });

    it('usa meetSpaceName já persistido em vez de derivar da URL, quando disponível', async () => {
      mockSpacesPatch.mockResolvedValue({ data: { name: 'spaces/ja-persistido' } });

      await googleMeetService.configureSpace({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        meetSpaceName: 'spaces/ja-persistido',
        habilitarGravacaoAutomatica: false,
      });

      expect(mockSpacesPatch).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'spaces/ja-persistido' }),
      );
    });

    it('retorna null (não lança) se a Meet API falhar', async () => {
      mockSpacesPatch.mockRejectedValue(new Error('permissão insuficiente'));

      const resultado = await googleMeetService.configureSpace({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        habilitarGravacaoAutomatica: false,
      });

      expect(resultado).toBeNull();
    });

    it('retorna null sem chamar a API quando não consegue derivar o código da sala', async () => {
      const resultado = await googleMeetService.configureSpace({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://exemplo.com/nao-e-meet',
        habilitarGravacaoAutomatica: false,
      });

      expect(resultado).toBeNull();
      expect(mockSpacesPatch).not.toHaveBeenCalled();
    });
  });

  describe('findGeneratedRecording', () => {
    it('retorna metadados da gravação quando o state é FILE_GENERATED', async () => {
      mockConferenceRecordsList.mockResolvedValue({
        data: { conferenceRecords: [{ name: 'conferenceRecords/rec-1' }] },
      });
      mockRecordingsList.mockResolvedValue({
        data: {
          recordings: [
            { name: 'conferenceRecords/rec-1/recordings/1', state: 'STARTED' },
            {
              name: 'conferenceRecords/rec-1/recordings/2',
              state: 'FILE_GENERATED',
              driveDestination: { file: 'drive-file-id', exportUri: 'https://drive.google.com/x' },
              startTime: '2026-08-22T10:00:00.000Z',
              endTime: '2026-08-22T11:00:00.000Z',
            },
          ],
        },
      });

      const resultado = await googleMeetService.findGeneratedRecording({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(mockConferenceRecordsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'space.name = "spaces/abc-defg-hij"' }),
      );
      expect(resultado).toEqual({
        recordingName: 'conferenceRecords/rec-1/recordings/2',
        driveFileId: 'drive-file-id',
        exportUri: 'https://drive.google.com/x',
        startTime: '2026-08-22T10:00:00.000Z',
        endTime: '2026-08-22T11:00:00.000Z',
      });
    });

    it('retorna null quando nenhuma gravação está FILE_GENERATED ainda', async () => {
      mockConferenceRecordsList.mockResolvedValue({
        data: { conferenceRecords: [{ name: 'conferenceRecords/rec-1' }] },
      });
      mockRecordingsList.mockResolvedValue({
        data: { recordings: [{ name: '.../1', state: 'STARTED' }] },
      });

      const resultado = await googleMeetService.findGeneratedRecording({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(resultado).toBeNull();
    });

    it('retorna null quando ainda não existe nenhum conferenceRecord', async () => {
      mockConferenceRecordsList.mockResolvedValue({ data: { conferenceRecords: [] } });

      const resultado = await googleMeetService.findGeneratedRecording({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(resultado).toBeNull();
      expect(mockRecordingsList).not.toHaveBeenCalled();
    });

    it('retorna null (não lança) se a consulta falhar', async () => {
      mockConferenceRecordsList.mockRejectedValue(new Error('sem permissão'));

      const resultado = await googleMeetService.findGeneratedRecording({
        oauth2Client: fakeOAuth2Client,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(resultado).toBeNull();
    });
  });
});
