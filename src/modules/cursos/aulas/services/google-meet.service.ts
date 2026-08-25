import { google } from 'googleapis';
import { logger } from '@/utils/logger';
import { extractMeetingCodeFromUrl } from './google-calendar.service';
import { googleOAuthService } from './google-oauth.service';

const meetLogger = logger.child({ module: 'GoogleMeet' });

// Evita depender diretamente do pacote `google-auth-library` (não hoisted no pnpm) —
// reaproveita o tipo já inferido pelo serviço que efetivamente cria o client.
type OAuth2Client = Awaited<ReturnType<typeof googleOAuthService.getOAuth2Client>>;

/**
 * Service de integração com a Google Meet REST API (v2) — complementa a Calendar API,
 * que continua responsável pelo evento/agenda/participantes. Este service só configura
 * a sala (acesso, moderação, gravação automática) e lê gravações depois da aula.
 *
 * Não substitui a Calendar API e não usa a Meet Media API.
 */
export const googleMeetService = {
  /**
   * Configura acesso restrito, moderação e (opcionalmente) gravação automática da sala.
   * Não-fatal: qualquer erro (permissão insuficiente, escopo ausente, edição do Workspace
   * sem suporte) é logado e ignorado — o evento/Meet já criado continua válido mesmo assim.
   */
  async configureSpace(params: {
    oauth2Client: OAuth2Client;
    meetUrl: string;
    meetSpaceName?: string | null;
    habilitarGravacaoAutomatica: boolean;
  }): Promise<{ spaceName: string } | null> {
    const spaceId = params.meetSpaceName ?? deriveSpaceIdFromUrl(params.meetUrl);

    if (!spaceId) {
      meetLogger.warn('[MEET_SPACE_SEM_CODIGO]', { meetUrl: params.meetUrl });
      return null;
    }

    try {
      const meet = google.meet({ version: 'v2', auth: params.oauth2Client });

      const res = await meet.spaces.patch({
        name: spaceId,
        updateMask: params.habilitarGravacaoAutomatica
          ? 'config.accessType,config.moderation,config.artifactConfig.recordingConfig.autoRecordingGeneration'
          : 'config.accessType,config.moderation',
        requestBody: {
          config: {
            accessType: 'RESTRICTED',
            moderation: 'ON',
            ...(params.habilitarGravacaoAutomatica
              ? { artifactConfig: { recordingConfig: { autoRecordingGeneration: 'ON' } } }
              : {}),
          },
        },
      });

      const spaceName = res.data.name ?? spaceId;
      meetLogger.info('[MEET_SPACE_CONFIGURADO]', { spaceName });
      return { spaceName };
    } catch (error: any) {
      meetLogger.warn('[MEET_SPACE_CONFIG_ERRO]', { spaceId, error: error?.message });
      return null;
    }
  },

  /**
   * Busca a gravação mais recente com state === 'FILE_GENERATED' para o space informado.
   * Retorna null (sem lançar) se ainda não houver conferência ou gravação disponível.
   */
  async findGeneratedRecording(params: {
    oauth2Client: OAuth2Client;
    meetUrl: string;
    meetSpaceName?: string | null;
  }): Promise<{
    recordingName: string;
    driveFileId: string | null;
    exportUri: string | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null> {
    const spaceId = params.meetSpaceName ?? deriveSpaceIdFromUrl(params.meetUrl);
    if (!spaceId) {
      return null;
    }

    try {
      const meet = google.meet({ version: 'v2', auth: params.oauth2Client });

      const conf = await meet.conferenceRecords.list({
        filter: `space.name = "${spaceId}"`,
        pageSize: 1,
      });

      const conferenceRecord = conf.data.conferenceRecords?.[0];
      if (!conferenceRecord?.name) {
        return null;
      }

      const recs = await meet.conferenceRecords.recordings.list({
        parent: conferenceRecord.name,
      });

      const gerada = recs.data.recordings?.find((r) => r.state === 'FILE_GENERATED');
      if (!gerada) {
        return null;
      }

      return {
        recordingName: gerada.name ?? '',
        driveFileId: gerada.driveDestination?.file ?? null,
        exportUri: gerada.driveDestination?.exportUri ?? null,
        startTime: gerada.startTime,
        endTime: gerada.endTime,
      };
    } catch (error: any) {
      meetLogger.warn('[MEET_RECORDING_LOOKUP_ERRO]', { spaceId, error: error?.message });
      return null;
    }
  },
};

function deriveSpaceIdFromUrl(meetUrl: string): string | null {
  const code = extractMeetingCodeFromUrl(meetUrl);
  return code ? `spaces/${code}` : null;
}
