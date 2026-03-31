import { EntrevistaStatus, StatusDeVagas } from '@prisma/client';

export const DEFAULT_INTERVIEW_TIMEZONE = 'America/Maceio';

export const ACTIVE_INTERVIEW_STATUSES: EntrevistaStatus[] = [EntrevistaStatus.AGENDADA];

export const TERMINAL_CANDIDATURA_STATUS_NAMES = [
  'CONTRATADO',
  'RECUSADO',
  'DESISTIU',
  'ARQUIVADO',
  'CANCELADO',
] as const;

export type InterviewModalidade = 'ONLINE' | 'PRESENCIAL' | 'TELEFONE';
export type InterviewDashboardModalidade = 'ONLINE' | 'PRESENCIAL';

export interface InterviewEnderecoPresencial {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  pontoReferencia: string | null;
}

export const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  AGENDADA: 'Agendada',
  CONFIRMADA: 'Confirmada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  REAGENDADA: 'Reagendada',
  NAO_COMPARECEU: 'Não compareceu',
};

export const INTERVIEW_MODALIDADE_LABELS: Record<InterviewModalidade, string> = {
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
  TELEFONE: 'Telefone',
};

export const VAGA_STATUS_LABELS: Record<StatusDeVagas, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANALISE: 'Em análise',
  PUBLICADO: 'Publicado',
  EXPIRADO: 'Expirado',
  DESPUBLICADA: 'Despublicada',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Encerrada',
};

const PREFIX_PRESENCIAL = 'presencial://';
const PREFIX_TELEFONE = 'telefone://';
const PREFIX_ONLINE = 'online://';
const GOOGLE_MEET_URI_REGEX =
  /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:[/?#].*)?$/i;

const normalizeNullableString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const decodeSegment = (value: string) => {
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeInterviewEndereco = (
  value?: Partial<InterviewEnderecoPresencial> | null,
): InterviewEnderecoPresencial => ({
  cep: normalizeNullableString(value?.cep),
  logradouro: normalizeNullableString(value?.logradouro),
  numero: normalizeNullableString(value?.numero),
  complemento: normalizeNullableString(value?.complemento),
  bairro: normalizeNullableString(value?.bairro),
  cidade: normalizeNullableString(value?.cidade),
  estado: normalizeNullableString(value?.estado)?.toUpperCase() ?? null,
  pontoReferencia: normalizeNullableString(value?.pontoReferencia),
});

const hasAnyEnderecoField = (value: InterviewEnderecoPresencial) =>
  Boolean(
    value.cep ||
      value.logradouro ||
      value.numero ||
      value.complemento ||
      value.bairro ||
      value.cidade ||
      value.estado ||
      value.pontoReferencia,
  );

export const formatInterviewEndereco = (
  value?: Partial<InterviewEnderecoPresencial> | null,
): string | null => {
  const endereco = normalizeInterviewEndereco(value);

  if (!hasAnyEnderecoField(endereco)) {
    return null;
  }

  const linhaPrincipal = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ').trim();

  const linhaSecundaria = [endereco.bairro, endereco.cidade, endereco.estado]
    .filter(Boolean)
    .join(' - ')
    .trim();

  const extras = [
    endereco.complemento ? `Compl.: ${endereco.complemento}` : null,
    endereco.cep ? `CEP: ${endereco.cep}` : null,
    endereco.pontoReferencia ? `Ref.: ${endereco.pontoReferencia}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
    .trim();

  return [linhaPrincipal, linhaSecundaria, extras].filter(Boolean).join(' | ') || null;
};

const parseEnderecoFromSegment = (segment: string) => {
  const decoded = decodeSegment(segment);
  if (!decoded) {
    return {
      enderecoPresencial: null,
      local: null,
    };
  }

  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const enderecoPresencial = normalizeInterviewEndereco(
        parsed as Partial<InterviewEnderecoPresencial>,
      );
      const local = formatInterviewEndereco(enderecoPresencial);

      return {
        enderecoPresencial: hasAnyEnderecoField(enderecoPresencial) ? enderecoPresencial : null,
        local,
      };
    }
  } catch {
    // fallback para payload legado em texto simples
  }

  return {
    enderecoPresencial: null,
    local: decoded,
  };
};

export const parseInterviewChannel = (rawValue?: string | null) => {
  const value = (rawValue ?? '').trim();

  if (!value) {
    return {
      modalidade: 'PRESENCIAL' as InterviewModalidade,
      modalidadeLabel: INTERVIEW_MODALIDADE_LABELS.PRESENCIAL,
      meetUrl: null,
      local: null,
      enderecoPresencial: null,
    };
  }

  if (value.startsWith(PREFIX_PRESENCIAL)) {
    const { enderecoPresencial, local } = parseEnderecoFromSegment(
      value.slice(PREFIX_PRESENCIAL.length),
    );
    return {
      modalidade: 'PRESENCIAL' as InterviewModalidade,
      modalidadeLabel: INTERVIEW_MODALIDADE_LABELS.PRESENCIAL,
      meetUrl: null,
      local,
      enderecoPresencial,
    };
  }

  if (value.startsWith(PREFIX_TELEFONE)) {
    const local = decodeSegment(value.slice(PREFIX_TELEFONE.length));
    return {
      modalidade: 'TELEFONE' as InterviewModalidade,
      modalidadeLabel: INTERVIEW_MODALIDADE_LABELS.TELEFONE,
      meetUrl: null,
      local,
      enderecoPresencial: null,
    };
  }

  if (value.startsWith(PREFIX_ONLINE)) {
    return {
      modalidade: 'ONLINE' as InterviewModalidade,
      modalidadeLabel: INTERVIEW_MODALIDADE_LABELS.ONLINE,
      meetUrl: null,
      local: null,
      enderecoPresencial: null,
    };
  }

  return {
    modalidade: 'ONLINE' as InterviewModalidade,
    modalidadeLabel: INTERVIEW_MODALIDADE_LABELS.ONLINE,
    meetUrl: value,
    local: null,
    enderecoPresencial: null,
  };
};

export const isValidGoogleMeetUrl = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? GOOGLE_MEET_URI_REGEX.test(normalized) : false;
};

export const encodeInterviewChannel = (params: {
  modalidade: InterviewModalidade;
  meetUrl?: string | null;
  local?: string | null;
  enderecoPresencial?: Partial<InterviewEnderecoPresencial> | null;
}) => {
  if (params.modalidade === 'ONLINE') {
    const meetUrl = params.meetUrl?.trim();
    return meetUrl || PREFIX_ONLINE;
  }

  const encodedLocal = encodeURIComponent((params.local ?? '').trim());

  if (params.modalidade === 'TELEFONE') {
    return `${PREFIX_TELEFONE}${encodedLocal}`;
  }

  const enderecoPresencial = normalizeInterviewEndereco(params.enderecoPresencial);
  if (hasAnyEnderecoField(enderecoPresencial)) {
    return `${PREFIX_PRESENCIAL}${encodeURIComponent(JSON.stringify(enderecoPresencial))}`;
  }

  return `${PREFIX_PRESENCIAL}${encodedLocal}`;
};

export const buildInterviewAgendaPayload = (params: {
  entrevistaId: string;
  modalidade: InterviewModalidade;
  meetEventId?: string | null;
  meetUrl?: string | null;
  organizerSource?: 'USER_OAUTH' | 'SYSTEM';
  organizerUserId?: string | null;
  organizerEmail?: string | null;
}) => {
  const basePayload = {
    eventoInternoId: params.entrevistaId,
    criadoNoSistema: true,
    organizerSource: params.organizerSource ?? ('SYSTEM' as const),
    organizerUserId: params.organizerUserId ?? null,
    organizerEmail: params.organizerEmail ?? null,
  };

  if (params.modalidade !== 'ONLINE') {
    return {
      ...basePayload,
      provider: 'INTERNAL_ONLY' as const,
    };
  }

  if (params.meetEventId || params.meetUrl) {
    return {
      ...basePayload,
      provider: 'GOOGLE_MEET' as const,
    };
  }

  return {
    ...basePayload,
    provider: 'INTERNAL_ONLY' as const,
  };
};

export const formatInterviewDateTime = (date: Date, timeZone = DEFAULT_INTERVIEW_TIMEZONE) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

export const getInterviewStatusLabel = (status: string) =>
  INTERVIEW_STATUS_LABELS[status] ?? status;

export const getVagaStatusLabel = (status: StatusDeVagas) => VAGA_STATUS_LABELS[status] ?? status;

export const humanizeStatusProcesso = (status?: string | null) => {
  if (!status) {
    return null;
  }

  const normalized = status
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return normalized || status;
};
